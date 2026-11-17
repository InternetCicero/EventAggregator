// Dashboard-Auswertung der Besucherstatistik (Spec 2026-11-16-statistik-dashboard, Phase 1).
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'secret';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/db/index');
const statsRepo = require('../src/db/statsRepo');
const { parseStatsQuery } = require('../src/stats/range');

// Dienstag, 10.11.2026
const NOW = Date.parse('2026-11-10T12:00:00+01:00');
const auth = { Authorization: `Basic ${Buffer.from('admin:secret').toString('base64')}` };

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

function clear() {
  db.exec('DELETE FROM stats_views; DELETE FROM stats_daily; DELETE FROM stats_hourly; DELETE FROM stats_device;');
}
function addDay(day, { views, visitors, seconds = 0, timed = 0, pages = {} }) {
  const ins = db.prepare(
    'INSERT INTO stats_daily (day, path, views, visitors, total_seconds, timed_views) VALUES (?, ?, ?, ?, ?, ?)',
  );
  ins.run(day, '*', views, visitors, seconds, timed);
  for (const [path, v] of Object.entries(pages)) ins.run(day, path, v, v, 0, 0);
}

// Zeitraum 04.11. bis 10.11. (heute = Di 10.11.), Vorperiode 28.10. bis 03.11.
function seedWeek() {
  clear();
  addDay('2026-11-04', { views: 20, visitors: 10, seconds: 600, timed: 10, pages: { '/': 20 } });
  addDay('2026-11-05', { views: 30, visitors: 15, seconds: 900, timed: 15, pages: { '/jobs': 30 } });
  addDay('2026-11-06', { views: 10, visitors: 5, seconds: 300, timed: 5, pages: { '/': 10 } });
  addDay('2026-11-07', { views: 4, visitors: 2, seconds: 60, timed: 2, pages: { '/materialien/:id': 4 } }); // Sa
  addDay('2026-11-08', { views: 6, visitors: 3, seconds: 90, timed: 3, pages: { '/jobs/:id': 6 } }); // So
  addDay('2026-11-09', { views: 40, visitors: 20, seconds: 1200, timed: 20, pages: { '/': 30, '/impressum': 10 } }); // gestern
  addDay('2026-11-01', { views: 14, visitors: 7, seconds: 140, timed: 7 });
  addDay('2026-11-03', { views: 10, visitors: 5, seconds: 100, timed: 5 });
  // Heute: zwei Besucher
  statsRepo.recordView({ ip: '1.1.1.1', userAgent: 'Mozilla/5.0 Safari', path: '/', now: NOW });
  statsRepo.recordView({ ip: '2.2.2.2', userAgent: 'Mozilla/5.0 Safari', path: '/jobs', now: NOW });
}

test('Dashboard: heute, gestern, Durchschnitt nur aus abgeschlossenen Tagen, Spitzentag (AC-2, AC-3)', () => {
  seedWeek();
  const d = statsRepo.getDashboard({ days: 7, now: NOW });
  assert.equal(d.days, 7);
  assert.equal(d.from, '2026-11-04');
  assert.equal(d.to, '2026-11-10');
  assert.equal(d.perDay.length, 7);
  assert.deepEqual(d.todayStats, { day: '2026-11-10', views: 2, visitors: 2 });
  assert.deepEqual(d.yesterdayStats, { day: '2026-11-09', views: 40, visitors: 20 });
  assert.equal(d.perDay.at(-1).partial, true);
  assert.equal(d.perDay[0].partial, false);
  // abgeschlossen: 04.11. bis 09.11. = 6 Tage, 55 Besucher, 110 Aufrufe
  assert.equal(d.completed.days, 6);
  assert.equal(d.completed.visitors, 55);
  assert.equal(d.completed.visitorsPerDay, 9.2);
  assert.equal(d.completed.views, 110);
  assert.equal(d.completed.viewsPerVisitor, 2);
  assert.equal(d.completed.avgSeconds, 57); // 3150 s / 55 Aufrufe mit Dauer
  assert.deepEqual(d.peak, { day: '2026-11-09', visitors: 20 });
  // Summe über alle sieben Tage inkl. heute
  assert.equal(d.totals.visitors, 57);
});

test('Dashboard: Vorperiode gleich lang direkt davor (AC-4)', () => {
  seedWeek();
  const d = statsRepo.getDashboard({ days: 7, now: NOW });
  assert.equal(d.previous.days, 7);
  assert.equal(d.previous.visitors, 12);
  assert.equal(d.previous.visitorsPerDay, 1.7);
  assert.equal(d.previous.viewsPerVisitor, 2);
});

test('Dashboard: leere Datenbank liefert Nullen statt Fehler oder Division durch null (AC-4)', () => {
  clear();
  const d = statsRepo.getDashboard({ days: 30, now: NOW });
  assert.equal(d.perDay.length, 30);
  assert.equal(d.completed.visitors, 0);
  assert.equal(d.completed.visitorsPerDay, 0);
  assert.equal(d.completed.viewsPerVisitor, 0);
  assert.equal(d.previous.visitors, 0);
  assert.equal(d.peak, null);
  assert.deepEqual(d.topPages, []);
  assert.ok(d.groups.every((g) => g.views === 0));
});

test('Dashboard: Seitengruppen summieren sich auf die Seitenaufrufe der Seiten (AC-5)', () => {
  seedWeek();
  const d = statsRepo.getDashboard({ days: 7, now: NOW });
  const byKey = Object.fromEntries(d.groups.map((g) => [g.key, g.views]));
  assert.equal(byKey.events, 20 + 10 + 30 + 1); // '/' an drei Tagen plus heute
  assert.equal(byKey.jobs, 30 + 6 + 1);
  assert.equal(byKey.materialien, 4);
  assert.equal(byKey.rechtliches, 10);
  const groupSum = d.groups.reduce((a, g) => a + g.views, 0);
  const pageSum = d.topPages.reduce((a, p) => a + p.views, 0);
  assert.equal(groupSum, pageSum);
});

test('Dashboard: Wochentagsmuster aus abgeschlossenen Tagen', () => {
  seedWeek();
  const d = statsRepo.getDashboard({ days: 7, now: NOW });
  assert.equal(d.weekday.length, 7);
  assert.equal(d.weekday.find((w) => w.weekday === 6).avgVisitors, 2);
  assert.equal(d.weekday.find((w) => w.weekday === 7).avgVisitors, 3);
  // heute (Dienstag) ist unvollständig und zählt nicht
  assert.equal(d.weekday.find((w) => w.weekday === 2).days, 0);
});

test('Dashboard: Monatsbalken für 12 Monate (AC-6)', () => {
  clear();
  addDay('2026-11-09', { views: 8, visitors: 4 });
  addDay('2026-11-02', { views: 6, visitors: 3 });
  addDay('2026-10-15', { views: 10, visitors: 5 });
  const q = parseStatsQuery({ range: '12m' }, NOW);
  assert.equal(q.from, '2025-12-01');
  const d = statsRepo.getDashboard({ ...q, now: NOW });
  assert.equal(d.perDay.length, 12);
  assert.equal(d.perDay[0].day, '2025-12');
  assert.equal(d.perDay.at(-1).day, '2026-11');
  assert.equal(d.perDay.at(-1).visitors, 7);
  assert.equal(d.perDay.at(-1).partial, true);
  assert.equal(d.perDay.at(-2).visitors, 5);
});

test('Zeitraum-Parameter werden geprüft (AC-6)', () => {
  assert.deepEqual(parseStatsQuery({}, NOW), { days: 7, granularity: 'day' });
  assert.deepEqual(parseStatsQuery({ days: '90' }, NOW), { days: 90, granularity: 'day' });
  assert.ok(parseStatsQuery({ days: '5' }, NOW).error);
  assert.deepEqual(parseStatsQuery({ from: '2026-11-01', to: '2026-11-05' }, NOW), {
    from: '2026-11-01',
    to: '2026-11-05',
    granularity: 'day',
  });
  // Ende in der Zukunft wird auf heute gekappt
  assert.equal(parseStatsQuery({ from: '2026-11-01', to: '2027-01-01' }, NOW).to, '2026-11-10');
  assert.ok(parseStatsQuery({ from: '2026-11-05', to: '2026-11-01' }, NOW).error);
  assert.ok(parseStatsQuery({ from: '2026-11-31', to: '2026-12-02' }, NOW).error);
  assert.ok(parseStatsQuery({ from: 'x', to: 'y' }, NOW).error);
  assert.ok(parseStatsQuery({ from: '2025-01-01', to: '2026-11-10' }, NOW).error); // über 400 Tage
  assert.equal(parseStatsQuery({ from: '2026-01-01', to: '2026-11-10' }, NOW).granularity, 'month');
});

test('Route: eigener Zeitraum und CSV nur mit Anmeldung (AC-7)', async () => {
  seedWeek();
  assert.equal((await fetch(`${base}/admin/stats.csv`)).status, 401);
  assert.equal((await fetch(`${base}/admin/stats.csv?days=3`, { headers: auth })).status, 400);

  const custom = await fetch(`${base}/admin/stats?from=2026-01-01&to=2026-01-05`, { headers: auth });
  assert.equal(custom.status, 200);
  const body = await custom.json();
  assert.equal(body.perDay.length, 5);
  assert.equal(body.completed.visitors, 0);
  assert.equal((await fetch(`${base}/admin/stats?from=2026-02-01&to=2026-01-05`, { headers: auth })).status, 400);

  const res = await fetch(`${base}/admin/stats.csv?from=2026-11-04&to=2026-11-06`, { headers: auth });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /statistik-2026-11-04_2026-11-06\.csv/);
  // fetch().text() entfernt die BOM; für Excel muss sie in den Bytes stehen
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 3)), [0xef, 0xbb, 0xbf]);
  const text = new TextDecoder('utf-8').decode(bytes);
  assert.ok(text.startsWith('Datum;Besucher;Aufrufe;Aufrufe je Besucher;Verweildauer in Sekunden'));
  const rows = text.trim().split('\r\n').slice(1);
  assert.deepEqual(rows, ['2026-11-04;10;20;2;60', '2026-11-05;15;30;2;60', '2026-11-06;5;10;2;60']);
});
