const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const eventsRepo = require('../db/eventsRepo');
const sourcesRepo = require('../db/sourcesRepo');
const { runSource, runAllActiveSources } = require('../scraper/runSource');
const db = require('../db/index');

router.use(adminAuth);

router.get('/events', (req, res) => {
  const status = req.query.status || 'pending';
  const events = eventsRepo.listEvents({ status });
  res.json(events);
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
  const { title, description, category, start_date, end_date, location, url, tags } = req.body;
  const stmt = db.prepare(`
    UPDATE events SET title=@title, description=@description, category=@category,
      start_date=@start_date, end_date=@end_date, location=@location, url=@url,
      updated_at=datetime('now')
    WHERE id=@id
  `);
  stmt.run({
    id: req.params.id,
    title,
    description,
    category,
    start_date,
    end_date: end_date || null,
    location,
    url,
  });
  if (tags) eventsRepo.setEventTags(req.params.id, tags);
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
