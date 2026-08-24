require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

require('./db/index'); // ensure schema is created

const eventsRouter = require('./routes/events');
const adminRouter = require('./routes/admin');
const { runAllActiveSources } = require('./scraper/runSource');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/events', eventsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Automatisches Scraping alle 6 Stunden, kein API-Key/KI beteiligt
cron.schedule('0 */6 * * *', async () => {
  console.log('[cron] Starte automatischen Scrape-Lauf...');
  const results = await runAllActiveSources();
  console.log('[cron] Fertig:', results);
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
