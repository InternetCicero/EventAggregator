// Besucherstatistik ohne personenbezogene Daten (Spec 2026-11-03-site-analytics).
process.env.EVENTS_DB_PATH = ':memory:';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/db/index');
const statsRepo = require('../src/db/statsRepo');
const { normalizePath, isBot } = require('../src/stats/path');

const UA = 'Mozilla/5.0 (Macintosh) Safari/605';
const DAY = 24 * 3600 * 1000;
const T0 = Date.parse('2026-11-10T10:00:00+01:00');

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
const clear = () => {
  db.exec('DELETE FROM stats_views; DELETE FROM stats_daily;');
};
const post = (url, body, headers = {}) =>
  fetch(`${base}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA, ...headers },
    body: JSON.stringify(body),
  });

test('Pfade: Query/Fragment entfernt, dynamische Pfade auf Muster, Unbekanntes verworfen (AC-10)', () => {
  assert.equal(normalizePath('/materialien?thema=x#a'), '/materialien');
  assert.equal(normalizePath('/materialien/cv-vorlage-canva'), '/materialien/:id');
  assert.equal(normalizePath('/jobs/42/'), '/jobs/:id');
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath('/admin'), null);
  assert.equal(normalizePath('/wp-login.php'), null);
  assert.equal(normalizePath('materialien'), null);
  assert.equal(normalizePath(42), null);
});

test('Bot-Erkennung (AC-7)', () => {
  assert.equal(isBot('Googlebot/2.1'), true);
  assert.equal(isBot('curl/8.0'), true);
  assert.equal(isBot(''), true);
  assert.equal(isBot(UA), false);
});

test('Aufruf speichert nur Tag, Pfad und Hash, keine IP/UA (AC-1, AC-2)', () => {
  clear();
  statsRepo.recordView({ ip: '203.0.113.7', userAgent: UA, path: '/materialien', now: T0 });
  const row = db.prepare('SELECT * FROM stats_views').get();
  assert.deepEqual(Object.keys(row).sort(), ['day', 'id', 'last_ping_at', 'path', 'seconds', 'started_at', 'visitor']);
  assert.equal(row.day, '2026-11-10');
  assert.ok(!JSON.stringify(row).includes('203.0.113.7'));
  assert.ok(!JSON.stringify(row).includes('Mozilla'));
});

test('Tageskennung: gleicher Tag gleich, anderer Tag verschieden (AC-3, AC-4)', () => {
  clear();
  const a = statsRepo.recordView({ ip: '1.1.1.1', userAgent: UA, path: '/', now: T0 });
  const b = statsRepo.recordView({ ip: '1.1.1.1', userAgent: UA, path: '/jobs', now: T0 + 1000 });
  statsRepo.recordView({ ip: '2.2.2.2', userAgent: UA, path: '/', now: T0 });
  const visitors = db.prepare('SELECT id, visitor FROM stats_views').all();
  const byId = Object.fromEntries(visitors.map((v) => [v.id, v.visitor]));
  assert.equal(byId[a], byId[b]);
  assert.equal(new Set(visitors.map((v) => v.visitor)).size, 2);
  assert.equal(statsRepo.getSummary(7, T0).totals.visitors, 2);

  statsRepo.recordView({ ip: '1.1.1.1', userAgent: UA, path: '/', now: T0 + DAY });
  const next = db.prepare("SELECT visitor FROM stats_views WHERE day = '2026-11-11'").get();
  assert.notEqual(next.visitor, byId[a]);
});

test('Dauer: nur Pings zählen, Lücken gedeckelt, höchstens 30 Minuten (AC-5, AC-6, AC-9)', () => {
  clear();
  const id = statsRepo.recordView({ ip: '1.1.1.1', userAgent: UA, path: '/', now: T0 });
  assert.equal(statsRepo.recordPing({ id, now: T0 + 15000 }), true);
  assert.equal(statsRepo.recordPing({ id, now: T0 + 30000 }), true);
  assert.equal(db.prepare('SELECT seconds FROM stats_views WHERE id = ?').get(id).seconds, 30);
  // Tab war 10 Minuten im Hintergrund: höchstens 20 s kommen dazu
  statsRepo.recordPing({ id, now: T0 + 30000 + 600000 });
  assert.equal(db.prepare('SELECT seconds FROM stats_views WHERE id = ?').get(id).seconds, 50);
  assert.equal(statsRepo.recordPing({ id: 'unbekannt', now: T0 }), false);
  // zu alter Aufruf
  assert.equal(statsRepo.recordPing({ id, now: T0 + 600000 + 30000 + 2 * 3600 * 1000 }), false);
  for (let t = 1; t <= 200; t++) statsRepo.recordPing({ id, now: T0 + 30000 + 600000 + t * 15000 });
  assert.ok(db.prepare('SELECT seconds FROM stats_views WHERE id = ?').get(id).seconds <= 1800);
});

test('Verdichtung: alte Aufrufe werden Tageswerte, Kennungen verschwinden (AC-11, AC-17)', () => {
  clear();
  const events = db.prepare('SELECT COUNT(*) c FROM events').get().c;
  for (const [ip, path] of [['1.1.1.1', '/'], ['1.1.1.1', '/jobs'], ['2.2.2.2', '/']]) {
    const id = statsRepo.recordView({ ip, userAgent: UA, path, now: T0 });
    statsRepo.recordPing({ id, now: T0 + 10000 });
  }
  statsRepo.recordView({ ip: '3.3.3.3', userAgent: UA, path: '/', now: T0 + 2 * DAY });
  const before = statsRepo.getSummary(30, T0 + 3 * DAY);

  statsRepo.compactOldViews(T0 + 3 * DAY);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM stats_views').get().c, 1); // nur der jüngste bleibt
  assert.equal(db.prepare('SELECT COUNT(*) c FROM events').get().c, events);
  assert.deepEqual(statsRepo.getSummary(30, T0 + 3 * DAY), before);
  const total = db.prepare("SELECT * FROM stats_daily WHERE path = '*'").get();
  assert.equal(total.views, 3);
  assert.equal(total.visitors, 2);
});

test('Sehr alte Tageswerte werden gelöscht', () => {
  clear();
  db.prepare("INSERT INTO stats_daily VALUES ('2025-01-01', '*', 5, 3, 100, 4)").run();
  db.prepare("INSERT INTO stats_daily VALUES ('2026-11-01', '*', 5, 3, 100, 4)").run();
  statsRepo.compactOldViews(T0);
  assert.deepEqual(db.prepare('SELECT day FROM stats_daily').all().map((r) => r.day), ['2026-11-01']);
});

test('Auswertung: Summen, Top-Seiten, durchschnittliche Dauer, leere Tage', () => {
  clear();
  const a = statsRepo.recordView({ ip: '1.1.1.1', userAgent: UA, path: '/materialien', now: T0 });
  statsRepo.recordPing({ id: a, now: T0 + 15000 });
  statsRepo.recordView({ ip: '2.2.2.2', userAgent: UA, path: '/materialien', now: T0 });
  const s = statsRepo.getSummary(7, T0);
  assert.equal(s.perDay.length, 7);
  assert.equal(s.perDay.at(-1).views, 2);
  assert.equal(s.perDay[0].views, 0);
  assert.deepEqual(s.topPages, [{ path: '/materialien', views: 2, visitors: 2, avgSeconds: 15 }]);
  assert.equal(s.totals.avgSeconds, 15);
});

test('Route: Aufruf und Ping (AC-1, AC-5)', async () => {
  clear();
  const res = await post('/stats/view', { path: '/materialien' });
  assert.equal(res.status, 200);
  const { id } = await res.json();
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.equal((await post('/stats/ping', { id })).status, 204);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM stats_views').get().c, 1);
});

test('Route: Bots, unbekannte Pfade, Admin, DNT und GPC werden nicht gespeichert (AC-7, AC-8)', async () => {
  clear();
  assert.equal((await post('/stats/view', { path: '/materialien' }, { 'User-Agent': 'Googlebot/2.1' })).status, 204);
  assert.equal((await post('/stats/view', { path: '/admin' })).status, 204);
  assert.equal((await post('/stats/view', { path: '/nope' })).status, 204);
  assert.equal((await post('/stats/view', { path: '/' }, { DNT: '1' })).status, 204);
  assert.equal((await post('/stats/view', { path: '/' }, { 'Sec-GPC': '1' })).status, 204);
  assert.equal((await post('/stats/ping', { id: 'zzzz' })).status, 204);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM stats_views').get().c, 0);
});

test('Route: Rate-Limit pro Besucher (AC-14)', async () => {
  clear();
  const headers = { 'User-Agent': 'Mozilla/5.0 Limit-Test' };
  let stored = 0;
  for (let i = 0; i < 130; i++) {
    const r = await post('/stats/view', { path: '/' }, headers);
    if (r.status === 200) stored++;
  }
  assert.ok(stored <= 120 && stored > 100, `gespeichert: ${stored}`);
});

test('Admin-Statistik nur mit Anmeldung und gültigem Zeitraum (AC-12, AC-13)', async () => {
  assert.equal((await fetch(`${base}/admin/stats`)).status, 401);
  const auth = { Authorization: `Basic ${Buffer.from('admin:secret').toString('base64')}` };
  assert.equal((await fetch(`${base}/admin/stats?days=5`, { headers: auth })).status, 400);
  const ok = await fetch(`${base}/admin/stats?days=30`, { headers: auth });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.days, 30);
  assert.equal(body.perDay.length, 30);
});
