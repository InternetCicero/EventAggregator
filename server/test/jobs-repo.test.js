// Datenzugriff für Stellen (Spec AC-1, AC-3, AC-5, AC-8, AC-10 bis AC-13).
process.env.EVENTS_DB_PATH = ':memory:';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/index');
const jobsRepo = require('../src/db/jobsRepo');
const companiesRepo = require('../src/db/companiesRepo');
const { validateJob } = require('../src/jobs/validateJob');
const { makeJobInput } = require('./helpers/jobFixture');

function addJob(overrides = {}, status = 'approved') {
  const { errors, job } = validateJob(makeJobInput(overrides));
  assert.deepEqual(errors, []);
  return jobsRepo.createJob({ ...job, company_id: overrides.company_id }, { status });
}

beforeEach(() => {
  db.exec('DELETE FROM jobs; DELETE FROM companies;');
});

test('AC-1: createJob speichert standardmäßig als pending', () => {
  const { job } = validateJob(makeJobInput());
  const id = jobsRepo.createJob(job);
  assert.equal(jobsRepo.getJob(id).status, 'pending');
});

test('AC-3: Vibe und Antworten werden als Objekte zurückgelesen', () => {
  const id = addJob({ answers: { week2: 'Kundentermin vorbereiten' } });
  const job = jobsRepo.getJob(id);
  assert.equal(job.vibe.structure, 3);
  assert.equal(job.answers.week2, 'Kundentermin vorbereiten');
});

test('AC-5: Kontakt-E-Mail ohne Einwilligung landet nicht in der DB', () => {
  const id = addJob({ contact_email: 'lisa@example.com', contact_consent: false });
  const row = db.prepare('SELECT contact_email FROM jobs WHERE id = ?').get(id);
  assert.equal(row.contact_email, null);
});

test('AC-8: Bulk-Freigabe und -Löschen zählen betroffene Zeilen', () => {
  const a = addJob({}, 'pending');
  const b = addJob({}, 'pending');
  assert.equal(jobsRepo.bulkUpdateStatus([a, b, 9999], 'approved'), 2);
  assert.equal(jobsRepo.getJob(a).status, 'approved');
  assert.equal(jobsRepo.bulkDelete([a, 9999]), 1);
  assert.equal(jobsRepo.getJob(a), null);
});

test('AC-10: nur freigegebene Stellen, neueste zuerst', () => {
  addJob({ title: 'Alt' });
  addJob({ title: 'Ausstehend' }, 'pending');
  addJob({ title: 'Abgelehnt' }, 'rejected');
  addJob({ title: 'Neu' });
  const titles = jobsRepo.listJobs().map((j) => j.title);
  assert.deepEqual(titles, ['Neu', 'Alt']);
});

test('AC-11: mehrere Filter gleichzeitig', () => {
  addJob({ title: 'Treffer', job_type: 'werkstudent', work_mode: 'remote', paid: 'yes', languages: ['en'] });
  addJob({ title: 'Falscher Typ', job_type: 'praktikum', work_mode: 'remote', paid: 'yes', languages: ['en'] });
  addJob({ title: 'Unbezahlt', job_type: 'werkstudent', work_mode: 'remote', paid: 'no', languages: ['en'] });
  addJob({ title: 'Nur Deutsch', job_type: 'werkstudent', work_mode: 'remote', paid: 'yes', languages: ['de'] });
  const titles = jobsRepo
    .listJobs({ job_type: 'werkstudent', work_mode: 'remote', paid: 'yes', language: 'en' })
    .map((j) => j.title);
  assert.deepEqual(titles, ['Treffer']);
});

test('AC-11: Abschluss "beides" und "egal" passen zu Bachelor', () => {
  addJob({ title: 'B', degree_level: 'bachelor' });
  addJob({ title: 'M', degree_level: 'master' });
  addJob({ title: 'Beides', degree_level: 'beides' });
  addJob({ title: 'Egal', degree_level: 'egal' });
  const titles = jobsRepo.listJobs({ degree_level: 'bachelor' }).map((j) => j.title).sort();
  assert.deepEqual(titles, ['B', 'Beides', 'Egal']);
});

test('AC-11: Branchenfilter über die zugeordnete Firma', () => {
  const consulting = companiesRepo.createCompany({ name: 'Beratung AG', website: null, sector: 'Consulting', size_bucket: null });
  addJob({ title: 'Mit Branche', company_id: consulting });
  addJob({ title: 'Ohne Firma' });
  const titles = jobsRepo.listJobs({ sector: 'Consulting' }).map((j) => j.title);
  assert.deepEqual(titles, ['Mit Branche']);
  assert.equal(jobsRepo.listJobs({ sector: 'Consulting' })[0].company.name, 'Beratung AG');
});

test('AC-12: Semesterfilter berücksichtigt fehlendes Mindestsemester', () => {
  addJob({ title: 'Ab 3', min_semester: 3 });
  addJob({ title: 'Ab 6', min_semester: 6 });
  addJob({ title: 'Ohne Angabe' });
  const titles = jobsRepo.listJobs({ semester: '4' }).map((j) => j.title).sort();
  assert.deepEqual(titles, ['Ab 3', 'Ohne Angabe']);
});

test('AC-13: nur Stellen mit Gehaltsangabe', () => {
  addJob({ title: 'Mit Min', salary_min: 1800 });
  addJob({ title: 'Mit Max', salary_max: 2200 });
  addJob({ title: 'Ohne' });
  const titles = jobsRepo.listJobs({ salary_given: '1' }).map((j) => j.title).sort();
  assert.deepEqual(titles, ['Mit Max', 'Mit Min']);
});

test('Sprachfilter erzeugt keine Teiltreffer', () => {
  addJob({ title: 'Englisch', languages: ['en'] });
  assert.equal(jobsRepo.listJobs({ language: 'e' }).length, 0);
});

test('Firma löschen setzt company_id der Stellen auf NULL', () => {
  const id = companiesRepo.createCompany({ name: 'Weg GmbH', website: null, sector: null, size_bucket: null });
  const jobId = addJob({ company_id: id });
  companiesRepo.deleteCompany(id);
  assert.equal(jobsRepo.getJob(jobId).company, null);
});
