const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const eventsRepo = require('../db/eventsRepo');
const sourcesRepo = require('../db/sourcesRepo');
const jobsRepo = require('../db/jobsRepo');
const companiesRepo = require('../db/companiesRepo');
const { validateJob } = require('../jobs/validateJob');
const { runSource, runAllActiveSources } = require('../scraper/runSource');
const db = require('../db/index');

router.use(adminAuth);

router.get('/events', (req, res) => {
  const status = req.query.status || 'pending';
  const events = eventsRepo.listEvents({ status });
  res.json(events);
});

function parseIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { error: 'ids muss ein nicht-leeres Array sein' };
  const numericIds = ids.map(Number).filter(Number.isInteger);
  if (numericIds.length !== ids.length) return { error: 'ids enthält ungültige Werte' };
  return { ids: numericIds };
}

const BULK_ACTIONS = {
  approve: (ids) => eventsRepo.bulkUpdateStatus(ids, 'approved'),
  reject: (ids) => eventsRepo.bulkUpdateStatus(ids, 'rejected'),
  delete: (ids) => eventsRepo.bulkDelete(ids),
};

router.post('/events/bulk', (req, res) => {
  const { ids, action } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids muss ein nicht-leeres Array sein' });
  }
  const numericIds = ids.map(Number).filter(Number.isInteger);
  if (numericIds.length !== ids.length) {
    return res.status(400).json({ error: 'ids enthält ungültige Werte' });
  }
  const handler = BULK_ACTIONS[action];
  if (!handler) {
    return res.status(400).json({ error: `action muss eine von ${Object.keys(BULK_ACTIONS).join(', ')} sein` });
  }

  const affected = handler(numericIds);
  res.json({ ok: true, affected });
});

router.post('/events/:id/approve', (req, res) => {
  eventsRepo.updateEventStatus(req.params.id, 'approved');
  res.json({ ok: true });
});

router.post('/events/:id/reject', (req, res) => {
  eventsRepo.updateEventStatus(req.params.id, 'rejected');
  res.json({ ok: true });
});

router.delete('/events/:id', (req, res) => {
  eventsRepo.deleteEvent(req.params.id);
  res.json({ ok: true });
});

router.put('/events/:id', (req, res) => {
  const { title, description, category, format, start_date, end_date, location, url, tags } = req.body;
  const stmt = db.prepare(`
    UPDATE events SET title=@title, description=@description, category=@category, format=@format,
      start_date=@start_date, end_date=@end_date, location=@location, url=@url,
      updated_at=datetime('now')
    WHERE id=@id
  `);
  stmt.run({
    id: req.params.id,
    title,
    description,
    category,
    format: format || null,
    start_date,
    end_date: end_date || null,
    location,
    url,
  });
  if (tags) eventsRepo.setEventTags(req.params.id, tags);
  res.json({ ok: true });
});

// Jobs & Praktika
router.get('/jobs', (req, res) => {
  const status = req.query.status || 'pending';
  res.json(jobsRepo.listJobs({ status }));
});

router.get('/jobs/:id', (req, res) => {
  const job = jobsRepo.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Stelle nicht gefunden' });
  res.json(job);
});

router.put('/jobs/:id', (req, res) => {
  if (!jobsRepo.getJob(req.params.id)) return res.status(404).json({ error: 'Stelle nicht gefunden' });
  const { errors, job } = validateJob(req.body || {}, { requireConsent: false });
  const companyId = req.body.company_id ? Number(req.body.company_id) : null;
  if (companyId && !companiesRepo.getCompany(companyId)) errors.push('Firma nicht gefunden');
  if (errors.length) return res.status(400).json({ error: errors.join('. '), errors });
  jobsRepo.updateJob(req.params.id, { ...job, company_id: companyId });
  res.json({ ok: true });
});

const JOB_BULK_ACTIONS = {
  approve: (ids) => jobsRepo.bulkUpdateStatus(ids, 'approved'),
  reject: (ids) => jobsRepo.bulkUpdateStatus(ids, 'rejected'),
  delete: (ids) => jobsRepo.bulkDelete(ids),
};

router.post('/jobs/bulk', (req, res) => {
  const { ids, error } = parseIds(req.body.ids);
  if (error) return res.status(400).json({ error });
  const handler = JOB_BULK_ACTIONS[req.body.action];
  if (!handler) {
    return res.status(400).json({ error: `action muss eine von ${Object.keys(JOB_BULK_ACTIONS).join(', ')} sein` });
  }
  res.json({ ok: true, affected: handler(ids) });
});

// Firmen CRUD
router.get('/companies', (req, res) => {
  res.json(companiesRepo.listCompanies());
});

router.post('/companies', (req, res) => {
  const { errors, company } = companiesRepo.normalize(req.body || {});
  if (!errors.length && companiesRepo.findByName(company.name)) errors.push('Firma existiert bereits');
  if (errors.length) return res.status(400).json({ error: errors.join('. ') });
  res.status(201).json({ id: companiesRepo.createCompany(company) });
});

router.put('/companies/:id', (req, res) => {
  if (!companiesRepo.getCompany(req.params.id)) return res.status(404).json({ error: 'Firma nicht gefunden' });
  const { errors, company } = companiesRepo.normalize(req.body || {});
  const existing = company.name && companiesRepo.findByName(company.name);
  if (existing && existing.id !== Number(req.params.id)) errors.push('Firma existiert bereits');
  if (errors.length) return res.status(400).json({ error: errors.join('. ') });
  companiesRepo.updateCompany(req.params.id, company);
  res.json({ ok: true });
});

router.delete('/companies/:id', (req, res) => {
  companiesRepo.deleteCompany(req.params.id);
  res.json({ ok: true });
});

// Sources CRUD
router.get('/sources', (req, res) => {
  res.json(sourcesRepo.listSources());
});

router.post('/sources', (req, res) => {
  const id = sourcesRepo.createSource(req.body);
  res.status(201).json({ id });
});

router.put('/sources/:id', (req, res) => {
  sourcesRepo.updateSource(req.params.id, req.body);
  res.json({ ok: true });
});

router.delete('/sources/:id', (req, res) => {
  sourcesRepo.deleteSource(req.params.id);
  res.json({ ok: true });
});

router.post('/sources/:id/run', async (req, res) => {
  const source = sourcesRepo.getSource(req.params.id);
  if (!source) return res.status(404).json({ error: 'Quelle nicht gefunden' });
  try {
    const result = await runSource(source);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sources/run-all', async (req, res) => {
  const results = await runAllActiveSources();
  res.json(results);
});

module.exports = router;
