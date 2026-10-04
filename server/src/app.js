// Express-App ohne listen() und ohne Cron, damit Tests sie auf einem
// zufälligen Port starten können. Gestartet wird sie in index.js.
const express = require('express');
const cors = require('cors');

require('./db/index'); // ensure schema is created

const eventsRouter = require('./routes/events');
const { router: jobsRouter } = require('./routes/jobs');
const adminRouter = require('./routes/admin');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/events', eventsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

module.exports = app;
