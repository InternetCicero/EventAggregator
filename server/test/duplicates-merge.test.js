// Duplikate im Admin zusammenführen (Spec: 2026-11-03-event-zusammenfuehren.md).
process.env.EVENTS_DB_PATH = ':memory:';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'testpass';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/db/index');
const sourcesRepo = require('../src/db/sourcesRepo');
const eventsRepo = require('../src/db/eventsRepo');
const { runSource } = require('../src/scraper/runSource');

const adminAuth = { Authorization: 'Basic ' + Buffer.from('admin:testpass').toString('base64') };
let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

let n = 0;
function make({ title, source, status = 'approved', duplicate_of = null, url = null }) {
  n++;
  return eventsRepo.createEvent({
    title, source, status, duplicate_of, url, category: 'Sonstiges', start_date: `2099-12-${String(10 + (n % 15)).padStart(2, '0')}T10:00`,
  });
}
// Original + markiertes Duplikat aus einer anderen Quelle
function pair(name, { originalStatus = 'approved', status = 'approved', dupUrl = 'https://dup.example/x' } = {}) {
  const original = make({ title: `${name} Original`, source: 'HHL', status: originalStatus, url: 'https://hhl.example/x' });
  const dup = make({ title: `${name} e-fellows`, source: 'e-Fellows', status, duplicate_of: original, url: dupUrl });
  return { original, dup };
}
const post = (path, body) =>
  fetch(`${base}/admin/events${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...adminAuth }, body: JSON.stringify(body || {}) });

test('AC-1/2: Zusammenführen vermerkt die Quelle am Original und lehnt das markierte Event ab', () => {
  const { original, dup } = pair('MBA Day Frankfurt');
  const result = eventsRepo.mergeEvent(dup);
  assert.equal(result.ok, true);
  assert.equal(result.into.id, original);
  assert.equal(eventsRepo.getEvent(dup).status, 'rejected');
  assert.equal(eventsRepo.getEvent(original).status, 'approved');
  assert.deepEqual(eventsRepo.getEvent(original).also_listed, [
    { source: 'e-Fellows', url: 'https://dup.example/x', title: 'MBA Day Frankfurt e-fellows' },
  ]);
});

test('AC-3: "Auch bei"-Einträge des markierten Events wandern zum Original, ohne Dopplungen', () => {
  const { original, dup } = pair('Master Day Stuttgart');
  eventsRepo.addListing(dup, { source: 'BCG', url: 'https://bcg.example', title: 'Master Day' });
  eventsRepo.addListing(dup, { source: 'HHL', url: 'https://hhl.example/own', title: 'Master Day' }); // Quelle des Originals
  eventsRepo.addListing(original, { source: 'BCG', url: 'https://bcg.example/schon', title: 'Master Day' }); // schon vermerkt
  assert.equal(eventsRepo.mergeEvent(dup).ok, true);
  const listed = eventsRepo.getEvent(original).also_listed;
  assert.deepEqual(listed.map((l) => l.source).sort(), ['BCG', 'e-Fellows']);
  assert.equal(listed.find((l) => l.source === 'BCG').url, 'https://bcg.example/schon');
});

test('AC-4: Quelle schon vermerkt oder Quelle des Originals: kein weiterer Eintrag, trotzdem abgelehnt', () => {
  const same = make({ title: 'Gleiche Quelle Original', source: 'HHL', url: null });
  const dup = make({ title: 'Gleiche Quelle Kopie', source: 'HHL', duplicate_of: same });
  assert.equal(eventsRepo.mergeEvent(dup).ok, true);
  assert.deepEqual(eventsRepo.getEvent(same).also_listed, []);
  assert.equal(eventsRepo.getEvent(dup).status, 'rejected');

  const { original, dup: dup2 } = pair('Schon Vermerkt');
  eventsRepo.addListing(original, { source: 'e-Fellows', url: 'https://alt.example', title: 'alt' });
  assert.equal(eventsRepo.mergeEvent(dup2).ok, true);
  assert.equal(eventsRepo.getEvent(original).also_listed.length, 1);
  assert.equal(eventsRepo.getEvent(original).also_listed[0].url, 'https://alt.example');
});

test('Event ohne Link: Eintrag ohne URL', () => {
  const { original, dup } = pair('Ohne Link', { dupUrl: null });
  eventsRepo.mergeEvent(dup);
  assert.equal(eventsRepo.getEvent(original).also_listed[0].url, null);
});

test('AC-5: nicht erlaubte Fälle ändern nichts', () => {
  const unmarked = make({ title: 'Unmarkiert', source: 'X' });
  assert.equal(eventsRepo.mergeEvent(unmarked).error, 'not_marked');

  const rejectedOriginal = pair('Original Abgelehnt', { originalStatus: 'rejected', status: 'pending' });
  assert.equal(eventsRepo.mergeEvent(rejectedOriginal.dup).error, 'original_rejected');
  assert.equal(eventsRepo.getEvent(rejectedOriginal.dup).status, 'pending');

  const notApproved = pair('Original Offen', { originalStatus: 'pending', status: 'approved' });
  assert.equal(eventsRepo.mergeEvent(notApproved.dup).error, 'original_not_approved');
  assert.equal(eventsRepo.getEvent(notApproved.dup).status, 'approved');
  assert.deepEqual(eventsRepo.getEvent(notApproved.original).also_listed, []);

  const alreadyRejected = pair('Schon Abgelehnt', { status: 'rejected' });
  assert.equal(eventsRepo.mergeEvent(alreadyRejected.dup).error, 'event_rejected');
  assert.equal(eventsRepo.mergeEvent(999999).error, 'not_found');
});

test('Erlaubt: ausstehendes Duplikat in freigegebenes oder ausstehendes Original', () => {
  const a = pair('Pending In Approved', { status: 'pending' });
  assert.equal(eventsRepo.mergeEvent(a.dup).ok, true);
  const b = pair('Pending In Pending', { originalStatus: 'pending', status: 'pending' });
  assert.equal(eventsRepo.mergeEvent(b.dup).ok, true);
});

test('AC-6: Original existiert nicht mehr: Markierung wird zurückgesetzt', () => {
  const { original, dup } = pair('Original Weg');
  db.pragma('foreign_keys = OFF');
  db.prepare('DELETE FROM events WHERE id = ?').run(original);
  db.pragma('foreign_keys = ON');
  assert.equal(eventsRepo.mergeEvent(dup).error, 'original_missing');
  assert.equal(eventsRepo.getEvent(dup).duplicate_of, null);
  assert.equal(eventsRepo.getEvent(dup).status, 'approved');
});

test('AC-7: schlägt ein Schritt fehl, wird nichts gespeichert', () => {
  const { original, dup } = pair('Rollback');
  eventsRepo.addListing(dup, { source: 'BCG', url: null, title: 'x' });
  db.exec(`CREATE TEMP TRIGGER fail_reject BEFORE UPDATE OF status ON events WHEN NEW.id = ${dup}
           BEGIN SELECT RAISE(ABORT, 'simulierter Fehler'); END;`);
  try {
    assert.throws(() => eventsRepo.mergeEvent(dup), /simulierter Fehler/);
  } finally {
    db.exec('DROP TRIGGER fail_reject');
  }
  assert.equal(eventsRepo.getEvent(dup).status, 'approved');
  assert.deepEqual(eventsRepo.getEvent(original).also_listed, []);
});

test('AC-8: "Kein Duplikat" setzt nur die Markierung zurück', () => {
  const { original, dup } = pair('Kein Duplikat');
  eventsRepo.addListing(dup, { source: 'BCG', url: null, title: 'x' });
  assert.equal(eventsRepo.clearDuplicate(dup), true);
  const event = eventsRepo.getEvent(dup);
  assert.equal(event.duplicate_of, null);
  assert.equal(event.status, 'approved');
  assert.equal(event.also_listed.length, 1);
  assert.deepEqual(eventsRepo.getEvent(original).also_listed, []);
  assert.equal(eventsRepo.clearDuplicate(dup), false);
  const flagged = eventsRepo.listEvents({ status: 'approved', onlyDuplicates: true, from: '2000-01-01' }).map((e) => e.id);
  assert.ok(!flagged.includes(dup));
});

// ---- Router (AC-9, AC-10, AC-14) ----

test('Einzel-Endpunkte: 200, 404, 409 mit verständlichem Grund', async () => {
  const { original, dup } = pair('Router Einzeln');
  const ok = await post(`/${dup}/merge`);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).into.id, original);

  const again = await post(`/${dup}/merge`);
  assert.equal(again.status, 409);
  assert.match((await again.json()).error, /bereits abgelehnt/);

  assert.equal((await post('/999999/merge')).status, 404);

  const open = pair('Router Offen', { originalStatus: 'pending' });
  const blocked = await post(`/${open.dup}/merge`);
  assert.equal(blocked.status, 409);
  assert.match((await blocked.json()).error, /Original zuerst freigeben/);

  const p = pair('Router Kein Dup');
  assert.equal((await post(`/${p.dup}/not-duplicate`)).status, 200);
  assert.equal(eventsRepo.getEvent(p.dup).duplicate_of, null);
  assert.equal((await post('/999999/not-duplicate')).status, 404);
});

test('AC-9/10: Sammelaktion führt erlaubte Events zusammen und meldet übersprungene mit Grund', async () => {
  const good1 = pair('Bulk Eins');
  const good2 = pair('Bulk Zwei', { status: 'pending' });
  const bad = pair('Bulk Offen', { originalStatus: 'pending' });
  const unmarked = make({ title: 'Bulk Unmarkiert', source: 'X' });
  const res = await post('/bulk', { ids: [good1.dup, bad.dup, good2.dup, unmarked], action: 'merge' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.affected, 2);
  assert.deepEqual(body.skipped.map((s) => s.id).sort(), [bad.dup, unmarked].sort());
  assert.ok(body.skipped.every((s) => s.title && s.reason));
  assert.equal(eventsRepo.getEvent(good1.dup).status, 'rejected');
  assert.equal(eventsRepo.getEvent(bad.dup).status, 'approved');

  const clear = await post('/bulk', { ids: [bad.dup], action: 'not-duplicate' });
  assert.deepEqual(await clear.json(), { ok: true, affected: 1, skipped: [] });
});

test('bestehende Sammelaktionen und Fehlermeldung bleiben erhalten', async () => {
  const e = make({ title: 'Bulk Alt', source: 'X', status: 'pending' });
  assert.equal((await (await post('/bulk', { ids: [e], action: 'reject' })).json()).affected, 1);
  const bad = await post('/bulk', { ids: [e], action: 'nope' });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /merge, not-duplicate/);
});

test('AC-14: ohne Admin-Anmeldung kein Zugriff', async () => {
  const { dup } = pair('Auth');
  for (const path of [`/${dup}/merge`, `/${dup}/not-duplicate`, '/bulk']) {
    const res = await fetch(`${base}/admin/events${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 401, path);
  }
  assert.equal(eventsRepo.getEvent(dup).status, 'approved');
});

// ---- Scraper (AC-13) ----

test('AC-13: zusammengeführtes Event kommt beim nächsten Lauf nicht zurück', async () => {
  const id = sourcesRepo.createSource({
    name: 'Wiederkehr Quelle', base_url: 'https://example.com', list_url: 'https://example.com/e',
    item_selector: '.card', title_selector: 'h3', date_selector: '.date', link_selector: 'a', category: 'Consulting', render_js: false,
  });
  const html = '<div class="card"><h3>Wiederkehr Spezialevent</h3><span class="date">15.12.2099</span><a href="/w/1">x</a></div>';
  const fetchPages = async () => [html];
  const source = sourcesRepo.getSource(id);
  await runSource(source, { fetchPages });
  const created = eventsRepo.listEvents({ status: 'pending', from: '2000-01-01' }).find((e) => e.title === 'Wiederkehr Spezialevent');
  const original = make({ title: 'Anderes Original', source: 'HHL' });
  db.prepare('UPDATE events SET duplicate_of = ? WHERE id = ?').run(original, created.id);
  assert.equal(eventsRepo.mergeEvent(created.id).ok, true);

  const again = await runSource(source, { fetchPages });
  assert.equal(again.inserted, 0);
  assert.equal(again.skipped, 1);
});
