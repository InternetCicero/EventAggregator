const eventsRepo = require('../../server/src/db/eventsRepo');
const jobsRepo = require('../../server/src/db/jobsRepo');
const sourcesRepo = require('../../server/src/db/sourcesRepo');
const { validateJob } = require('../../server/src/jobs/validateJob');
const { dimensions } = require('../../server/src/db/vibe');
const db = require('../../server/src/db/index');
const statsRepo = require('../../server/src/db/statsRepo');

// Wörter ohne Leerzeichen sind der härteste Fall für Zeilenumbrüche.
const LONG_WORD = 'Supercalifragilistisch'.repeat(9); // ~200 Zeichen
const LONG_URL = 'https://example.com/' + 'sehr-lange-url-ohne-umbruch/'.repeat(11) + '?x=1';

const vibe = Object.fromEntries(dimensions.map((d) => [d.key, 3]));

function seed() {
  const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  eventsRepo.createEvent({
    title: 'Normales Event',
    description: 'Kurze Beschreibung.',
    category: 'Networking',
    start_date: day(5),
    location: 'Frankfurt',
    url: 'https://example.com/event',
    status: 'approved',
  });
  eventsRepo.createEvent({
    title: LONG_WORD,
    description: LONG_WORD,
    category: 'Workshop & Case Study',
    start_date: day(6),
    location: LONG_WORD,
    url: LONG_URL,
    source: LONG_WORD,
    tags: [LONG_WORD.slice(0, 60)],
    status: 'approved',
  });
  eventsRepo.createEvent({
    title: 'Ausstehendes Event ' + LONG_WORD,
    category: 'Sonstiges',
    start_date: day(7),
    url: LONG_URL,
    status: 'pending',
  });

  const base = {
    title: 'Praktikum Strategy',
    company_name: 'Testfirma GmbH',
    job_type: 'praktikum',
    apply_url: 'https://example.com/bewerben',
    vibe,
    consent: true,
  };
  for (const overrides of [
    {},
    { title: LONG_WORD, company_name: LONG_WORD, apply_url: LONG_URL },
  ]) {
    const { errors, job } = validateJob({ ...base, ...overrides });
    if (errors.length) throw new Error('Seed-Stelle ungültig: ' + errors.join('; '));
    jobsRepo.createJob({ ...job, source_kind: 'admin' }, { status: 'approved' });
  }

  sourcesRepo.createSource({
    name: 'Quelle mit sehr langer URL',
    base_url: 'https://example.com',
    list_url: LONG_URL,
    item_selector: '.item',
    title_selector: '.title',
  });
}

// 120 Tage Statistik: normale Werte, ein Tag mit sehr hohen Zahlen (Beschriftungen/Karten dürfen nicht überlaufen)
function seedStats() {
  const today = statsRepo.dayOf(Date.now());
  const ins = db.prepare(
    `INSERT INTO stats_daily (day, path, views, visitors, total_seconds, timed_views, dur_short, dur_mid, dur_long, dur_xlong, single_visitors)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const hourly = db.prepare('INSERT INTO stats_hourly (day, hour, views) VALUES (?, ?, ?)');
  const device = db.prepare('INSERT INTO stats_device (day, device, views) VALUES (?, ?, ?)');
  const pages = ['/', '/jobs', '/jobs/:id', '/materialien', '/materialien/:id', '/einreichen', '/impressum'];
  for (let i = 1; i <= 120; i++) {
    const day = statsRepo.shiftDay(today, -i);
    const visitors = i === 3 ? 1234567 : 20 + ((i * 7) % 45);
    const views = visitors * 2 + 3;
    // Phase-2-Werte gibt es nur für die letzten 60 Tage (davor "nicht erfasst", wie vor dem Update)
    const p2 = i <= 60;
    const cut = (share) => Math.floor(views * share);
    ins.run(
      day, '*', views, visitors, visitors * 40, visitors,
      p2 ? cut(0.4) : null, p2 ? cut(0.3) : null, p2 ? cut(0.2) : null, p2 ? views - cut(0.4) - cut(0.3) - cut(0.2) : null,
      p2 ? Math.floor(visitors * 0.45) : null,
    );
    pages.forEach((path, n) =>
      ins.run(day, path, Math.round(views / (n + 2)), Math.round(visitors / (n + 2)), 0, 0, null, null, null, null, null),
    );
    if (p2) {
      for (let h = 0; h < 24; h++) hourly.run(day, h, Math.max(1, Math.round((views / 24) * (h >= 8 && h <= 22 ? 1.5 : 0.2))));
      device.run(day, 'mobile', Math.floor(views * 0.6));
      device.run(day, 'desktop', Math.floor(views * 0.3));
      device.run(day, 'tablet', Math.floor(views * 0.08));
      device.run(day, 'other', views - Math.floor(views * 0.6) - Math.floor(views * 0.3) - Math.floor(views * 0.08));
    }
  }
}

module.exports = { seed, seedStats, LONG_WORD, LONG_URL };
