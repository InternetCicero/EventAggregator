const express = require('express');
const multer = require('multer');
const router = express.Router();
const eventsRepo = require('../db/eventsRepo');
const categories = require('../db/categories');
const { extractFromUrl } = require('../scraper/extractFromUrl');
const { extractTextFromImage } = require('../scraper/extractFromImage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Nur Bilddateien sind erlaubt'));
    cb(null, true);
  },
});

router.get('/categories', (req, res) => {
  res.json(categories);
});

router.get('/tags', (req, res) => {
  res.json(eventsRepo.listAllTags());
});

router.get('/', (req, res) => {
  const { category, tag, from, to, search } = req.query;
  const events = eventsRepo.listEvents({ status: 'approved', category, tag, from, to, search });
  res.json(events);
});

router.get('/:id', (req, res) => {
  const event = eventsRepo.getEvent(req.params.id);
  if (!event || event.status !== 'approved') return res.status(404).json({ error: 'Nicht gefunden' });
  res.json(event);
});

router.post('/extract-link', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url ist erforderlich' });
  try {
    const result = await extractFromUrl(url);
    res.json(result);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

router.post('/extract-image', (req, res) => {
  upload.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    if (!req.file) return res.status(400).json({ error: 'Bilddatei ist erforderlich (Feld "image")' });
    try {
      const text = await extractTextFromImage(req.file.buffer);
      res.json({ text });
    } catch (err) {
      res.status(500).json({ error: 'Texterkennung fehlgeschlagen: ' + err.message });
    }
  });
});

router.post('/', (req, res) => {
  const { title, description, category, start_date, end_date, location, url, tags, submitter_name } = req.body;

  if (!title || !category || !start_date) {
    return res.status(400).json({ error: 'title, category und start_date sind erforderlich' });
  }
  if (!categories.includes(category)) {
    return res.status(400).json({ error: 'Ungültige Kategorie' });
  }

  const id = eventsRepo.createEvent({
    title,
    description,
    category,
    start_date,
    end_date,
    location,
    url,
    tags,
    submitter_name,
    source: 'manual',
    status: 'pending',
  });

  res.status(201).json({ id, status: 'pending', message: 'Event eingereicht, wartet auf Freigabe.' });
});

module.exports = router;
