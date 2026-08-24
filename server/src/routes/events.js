const express = require('express');
const router = express.Router();
const eventsRepo = require('../db/eventsRepo');
const categories = require('../db/categories');

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
