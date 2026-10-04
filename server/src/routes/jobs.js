const express = require('express');
const router = express.Router();
const jobsRepo = require('../db/jobsRepo');
const jobTypes = require('../db/jobTypes');
const sectors = require('../db/sectors');
const languages = require('../db/languages');
const vibe = require('../db/vibe');
const { validateJob } = require('../jobs/validateJob');
const { extractJobFromUrl } = require('../scraper/extractFromUrl');

// Öffentliche Sicht auf eine Stelle: Kontakt-E-Mail nur mit Einwilligung
// (AC-15), der Name der einreichenden Person ist reine Moderationsinfo.
function toPublic(job) {
  const { submitter_name, contact_email, ...rest } = job;
  return { ...rest, contact_email: job.contact_consent ? contact_email : null };
}

router.get('/meta', (req, res) => {
  res.json({
    jobTypes,
    sectors,
    languages,
    dimensions: vibe.dimensions,
    questions: vibe.questions,
    answerMaxLength: vibe.ANSWER_MAX_LENGTH,
    referrerNoteMaxLength: vibe.REFERRER_NOTE_MAX_LENGTH,
  });
});

router.get('/', (req, res) => {
  const { job_type, degree_level, semester, work_mode, paid, language, sector, location, salary_given, search } =
    req.query;
  const jobs = jobsRepo.listJobs({
    status: 'approved',
    job_type,
    degree_level,
    semester,
    work_mode,
    paid,
    language,
    sector,
    location,
    salary_given,
    search,
  });
  res.json(jobs.map(toPublic));
});

router.post('/extract-link', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url ist erforderlich' });
  try {
    res.json(await extractJobFromUrl(url));
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const job = jobsRepo.getJob(req.params.id);
  if (!job || job.status !== 'approved') return res.status(404).json({ error: 'Nicht gefunden' });
  res.json(toPublic(job));
});

router.post('/', (req, res) => {
  const { errors, job } = validateJob(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join('. '), errors });

  // Öffentliche Einreichungen sind immer "member"; "admin"/"company" setzt
  // nur der Admin bei der Freigabe (in v2 dann über verifizierte Accounts).
  const id = jobsRepo.createJob({ ...job, source_kind: 'member' }, { status: 'pending' });
  res.status(201).json({ id, status: 'pending', message: 'Stelle eingereicht, wartet auf Freigabe.' });
});

module.exports = { router, toPublic };
