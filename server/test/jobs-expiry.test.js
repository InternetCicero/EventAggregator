// Automatischer Ablauf von Stellen (Spec AC-18, AC-19).
process.env.EVENTS_DB_PATH = ':memory:';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/index');
const jobsRepo = require('../src/db/jobsRepo');
const { validateJob } = require('../src/jobs/validateJob');
const { makeJobInput } = require('./helpers/jobFixture');

function addJob(overrides = {}, { status = 'approved', updatedAt } = {}) {
  const { job } = validateJob(makeJobInput(overrides));
  const id = jobsRepo.createJob(job, { status });
  if (updatedAt) db.prepare('UPDATE jobs SET updated_at = ? WHERE id = ?').run(updatedAt, id);
  return id;
}

beforeEach(() => db.exec('DELETE FROM jobs;'));

test('AC-18: Frist gestern => expired, Frist heute bleibt', () => {
  const past = addJob({ deadline: '2026-10-03' });
  const today = addJob({ deadline: '2026-10-04' });
  jobsRepo.expireJobs({ today: '2026-10-04', maxAgeDays: 90 });
  assert.equal(jobsRepo.getJob(past).status, 'expired');
  assert.equal(jobsRepo.getJob(today).status, 'approved');
});

test('AC-19: ohne Frist und länger als maxAgeDays nicht aktualisiert => expired', () => {
  const old = addJob({}, { updatedAt: '2026-07-01 10:00:00' });
  const fresh = addJob({}, { updatedAt: '2026-09-01 10:00:00' });
  const n = jobsRepo.expireJobs({ today: '2026-10-04', maxAgeDays: 90 });
  assert.equal(n, 1);
  assert.equal(jobsRepo.getJob(old).status, 'expired');
  assert.equal(jobsRepo.getJob(fresh).status, 'approved');
});

test('AC-19: Stellen mit Frist in der Zukunft laufen nicht nach maxAgeDays ab', () => {
  const id = addJob({ deadline: '2027-01-31' }, { updatedAt: '2026-01-01 10:00:00' });
  jobsRepo.expireJobs({ today: '2026-10-04', maxAgeDays: 90 });
  assert.equal(jobsRepo.getJob(id).status, 'approved');
});

test('nur freigegebene Stellen laufen ab, pending bleibt pending', () => {
  const id = addJob({ deadline: '2026-01-01' }, { status: 'pending' });
  jobsRepo.expireJobs({ today: '2026-10-04', maxAgeDays: 90 });
  assert.equal(jobsRepo.getJob(id).status, 'pending');
});
