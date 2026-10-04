// HTTP-Verhalten der Jobs-Endpunkte (Spec AC-1, AC-2, AC-9, AC-14, AC-15).
process.env.EVENTS_DB_PATH = ':memory:';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'testpass';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const jobsRepo = require('../src/db/jobsRepo');
const { makeJobInput } = require('./helpers/jobFixture');

let server;
let base;
const adminAuth = { Authorization: 'Basic ' + Buffer.from('admin:testpass').toString('base64') };

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => server.close());

function post(path, body, headers = {}) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('AC-1: Einreichung gibt 201 und landet als pending', async () => {
  const res = await post('/jobs', makeJobInput({ source_kind: 'admin' }));
  assert.equal(res.status, 201);
  const { id, status } = await res.json();
  assert.equal(status, 'pending');
  // öffentliche Einreichungen können sich nicht als "admin" ausgeben
  assert.equal(jobsRepo.getJob(id).source_kind, 'member');
});

test('AC-2: ungültige Einreichung gibt 400 mit deutscher Meldung', async () => {
  const res = await post('/jobs', makeJobInput({ title: '' }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /Titel fehlt/);
});

test('AC-9: Admin-Endpunkte für Jobs und Firmen ohne Login => 401', async () => {
  for (const path of ['/admin/jobs', '/admin/companies']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 401, path);
  }
  const bulk = await post('/admin/jobs/bulk', { ids: [1], action: 'approve' });
  assert.equal(bulk.status, 401);
});

test('AC-14: nicht freigegebene oder unbekannte Stelle => 404', async () => {
  const created = await (await post('/jobs', makeJobInput())).json();
  assert.equal((await fetch(`${base}/jobs/${created.id}`)).status, 404);
  assert.equal((await fetch(`${base}/jobs/999999`)).status, 404);
});

test('AC-15: Kontakt-E-Mail nur mit Einwilligung öffentlich, Einreicher nie', async () => {
  const withConsent = await (
    await post('/jobs', makeJobInput({ contact_email: 'a@example.com', contact_consent: true, submitter_name: 'Max' }))
  ).json();
  const withoutConsent = await (await post('/jobs', makeJobInput({ contact_email: 'b@example.com' }))).json();

  const approve = await post('/admin/jobs/bulk', { ids: [withConsent.id, withoutConsent.id], action: 'approve' }, adminAuth);
  assert.equal((await approve.json()).affected, 2);

  const a = await (await fetch(`${base}/jobs/${withConsent.id}`)).json();
  const b = await (await fetch(`${base}/jobs/${withoutConsent.id}`)).json();
  assert.equal(a.contact_email, 'a@example.com');
  assert.equal(b.contact_email, null);
  assert.equal(a.submitter_name, undefined);

  // Admin entzieht die Einwilligung nachträglich => E-Mail verschwindet
  const job = jobsRepo.getJob(withConsent.id);
  const put = await fetch(`${base}/admin/jobs/${withConsent.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...adminAuth },
    body: JSON.stringify({ ...job, contact_consent: false }),
  });
  assert.equal(put.status, 200);
  const a2 = await (await fetch(`${base}/jobs/${withConsent.id}`)).json();
  assert.equal(a2.contact_email, null);
});

test('Liste: Filter per Query-String', async () => {
  const res = await fetch(`${base}/jobs?paid=yes`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(await res.json()));
});

test('Meta liefert Stellenarten, 7 Vibe-Dimensionen und 5 Leitfragen', async () => {
  const meta = await (await fetch(`${base}/jobs/meta`)).json();
  assert.ok(meta.jobTypes.length > 0);
  assert.equal(meta.dimensions.length, 7);
  assert.equal(meta.questions.length, 5);
});

test('Admin: Firma anlegen, Duplikat ablehnen, Stelle zuordnen', async () => {
  const created = await post('/admin/companies', { name: 'Route AG', sector: 'Tech' }, adminAuth);
  assert.equal(created.status, 201);
  const { id: companyId } = await created.json();
  const dup = await post('/admin/companies', { name: 'route ag' }, adminAuth);
  assert.equal(dup.status, 400);

  const { id: jobId } = await (await post('/jobs', makeJobInput())).json();
  const job = jobsRepo.getJob(jobId);
  const put = await fetch(`${base}/admin/jobs/${jobId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...adminAuth },
    body: JSON.stringify({ ...job, company_id: companyId }),
  });
  assert.equal(put.status, 200);
  assert.equal(jobsRepo.getJob(jobId).company.name, 'Route AG');
});
