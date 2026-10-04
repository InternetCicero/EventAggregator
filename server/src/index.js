require('dotenv').config({ quiet: true });
const cron = require('node-cron');

const app = require('./app');
const { runAllActiveSources } = require('./scraper/runSource');
const jobsRepo = require('./db/jobsRepo');

const PORT = process.env.PORT || 4000;
const JOB_MAX_AGE_DAYS = Number(process.env.JOB_MAX_AGE_DAYS) || 90;

// Sicherheitsnetz: ein einzelner fehlerhafter Hintergrund-Task (z. B. OCR-Worker)
// soll den ganzen Server nicht abschießen.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});

// Automatisches Scraping alle 6 Stunden, kein API-Key/KI beteiligt
cron.schedule('0 */6 * * *', async () => {
  console.log('[cron] Starte automatischen Scrape-Lauf...');
  const results = await runAllActiveSources();
  console.log('[cron] Fertig:', results);
});

// Stellen mit abgelaufener Frist oder ohne Aktualisierung seit
// JOB_MAX_AGE_DAYS Tagen täglich ausblenden (Spec AC-18/AC-19)
function expireJobs() {
  const expired = jobsRepo.expireJobs({ maxAgeDays: JOB_MAX_AGE_DAYS });
  if (expired) console.log(`[cron] ${expired} Stelle(n) abgelaufen`);
}
cron.schedule('15 3 * * *', expireJobs);
expireJobs();

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
