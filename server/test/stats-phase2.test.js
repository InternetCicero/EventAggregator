// Statistik Phase 2 (Spec 2026-11-16-statistik-dashboard): Verweildauer-Klassen, Einzelaufruf-Besucher,
// Tageszeit und Gerätekategorie. Es werden nur Zähler gespeichert (AC-10 bis AC-12).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/index');
const statsRepo = require('../src/db/statsRepo');
const { deviceClass } = require('../src/stats/device');

const UA_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 Safari/605';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Mobile/15E148 Safari/604';
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605 Mobile/15E148 Safari/604';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537 Chrome/120 Mobile Safari/537';
const UA_ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537 Chrome/120 Safari/537';

// Dienstag, 10.11.2026, 10:00 Uhr Berlin
const T0 = Date.parse('2026-11-10T10:00:00+01:00');
const DAY = 24 * 3600 * 1000;

const clear = () =>
  db.exec('DELETE FROM stats_views; DELETE FROM stats_daily; DELETE FROM stats_hourly; DELETE FROM stats_device;');

test('Gerätekategorie nur grob: Handy, Tablet, Desktop, sonst', () => {
  assert.equal(deviceClass(UA_IPHONE), 'mobile');
  assert.equal(deviceClass(UA_ANDROID), 'mobile');
  assert.equal(deviceClass(UA_IPAD), 'tablet');
  assert.equal(deviceClass(UA_ANDROID_TABLET), 'tablet');
  assert.equal(deviceClass(UA_DESKTOP), 'desktop');
  assert.equal(deviceClass('Mozilla/5.0 (X11; Linux x86_64) Firefox/120'), 'desktop');
  assert.equal(deviceClass('SomethingOdd/1.0'), 'other');
  assert.equal(deviceClass(''), 'other');
  assert.equal(deviceClass(undefined), 'other');
});

test('Stunde wird in Europe/Berlin erfasst, auch bei Sommerzeit', () => {
  assert.equal(statsRepo.hourOf(T0), 10);
  assert.equal(statsRepo.hourOf(Date.parse('2026-07-01T10:00:00+02:00')), 10);
  assert.equal(statsRepo.hourOf(Date.parse('2026-11-10T00:30:00+01:00')), 0);
  assert.equal(statsRepo.hourOf(Date.parse('2026-11-10T23:59:00+01:00')), 23);
});

test('Aufruf speichert Stunde und Kategorie, nie Browserkennung oder IP (AC-11)', () => {
  clear();
  statsRepo.recordView({ ip: '203.0.113.7', userAgent: UA_IPHONE, path: '/jobs', now: T0 });
  const row = db.prepare('SELECT * FROM stats_views').get();
  assert.equal(row.hour, 10);
  assert.equal(row.device, 'mobile');
  const dump = JSON.stringify(row);
  assert.ok(!dump.includes('iPhone') && !dump.includes('Mozilla') && !dump.includes('203.0.113.7'));
});

test('Schema: keine Spalte für IP, Browserkennung oder Herkunft in den Statistik-Tabellen (AC-11)', () => {
  for (const table of ['stats_views', 'stats_daily', 'stats_hourly', 'stats_device']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    for (const forbidden of ['ip', 'user_agent', 'useragent', 'ua', 'referrer', 'referer', 'url']) {
      assert.ok(!cols.includes(forbidden), `${table} hat Spalte ${forbidden}`);
    }
  }
});

test('Verdichtung: Dauer-Klassen, Einzelaufruf-Besucher, Stunden und Geräte (AC-10, AC-11)', () => {
  clear();
  const day = T0 - 5 * DAY; // 05.11.2026, älter als 2 Tage
  // Besucher A: ein Aufruf mit 5 s (kurz); Besucher B: zwei Aufrufe (30 s und 400 s); Besucher C: ein Aufruf 90 s
  const a = statsRepo.recordView({ ip: '1.1.1.1', userAgent: UA_DESKTOP, path: '/', now: day });
  statsRepo.recordPing({ id: a, now: day + 5000 });
  const b1 = statsRepo.recordView({ ip: '2.2.2.2', userAgent: UA_IPHONE, path: '/', now: day + 3600 * 1000 });
  const b2 = statsRepo.recordView({ ip: '2.2.2.2', userAgent: UA_IPHONE, path: '/jobs', now: day + 3600 * 1000 });
  db.prepare('UPDATE stats_views SET seconds = 30 WHERE id = ?').run(b1);
  db.prepare('UPDATE stats_views SET seconds = 400 WHERE id = ?').run(b2);
  const c = statsRepo.recordView({ ip: '3.3.3.3', userAgent: UA_IPAD, path: '/', now: day + 2 * 3600 * 1000 });
  db.prepare('UPDATE stats_views SET seconds = 90 WHERE id = ?').run(c);

  statsRepo.compactOldViews(T0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM stats_views').get().n, 0);

  const d = db.prepare("SELECT * FROM stats_daily WHERE day = ? AND path = '*'").get('2026-11-05');
  assert.equal(d.views, 4);
  assert.equal(d.visitors, 3);
  assert.equal(d.dur_short, 1); // 5 s
  assert.equal(d.dur_mid, 1); // 30 s
  assert.equal(d.dur_long, 1); // 90 s
  assert.equal(d.dur_xlong, 1); // 400 s
  assert.equal(d.single_visitors, 2); // A und C haben nur einen Aufruf
  // Seiten-Zeilen bekommen keine Phase-2-Werte
  assert.equal(db.prepare("SELECT dur_short FROM stats_daily WHERE day = '2026-11-05' AND path = '/jobs'").get().dur_short, null);

  const hours = db.prepare('SELECT hour, views FROM stats_hourly WHERE day = ? ORDER BY hour').all('2026-11-05');
  assert.deepEqual(hours, [
    { hour: 10, views: 1 },
    { hour: 11, views: 2 },
    { hour: 12, views: 1 },
  ]);
  const devices = db.prepare('SELECT device, views FROM stats_device WHERE day = ? ORDER BY device').all('2026-11-05');
  assert.deepEqual(devices, [
    { device: 'desktop', views: 1 },
    { device: 'mobile', views: 2 },
    { device: 'tablet', views: 1 },
  ]);
});

test('Auswertung: Verteilungen nur aus abgeschlossenen Tagen mit Daten, Altdaten zählen nicht (AC-12)', () => {
  clear();
  // Alter Tag aus der Zeit vor dem Update: Phase-2-Spalten NULL
  db.prepare(
    "INSERT INTO stats_daily (day, path, views, visitors, total_seconds, timed_views) VALUES ('2026-11-04', '*', 50, 25, 500, 20)",
  ).run();
  // Neuer verdichteter Tag mit Phase-2-Werten
  db.prepare(
    `INSERT INTO stats_daily (day, path, views, visitors, total_seconds, timed_views, dur_short, dur_mid, dur_long, dur_xlong, single_visitors)
     VALUES ('2026-11-06', '*', 10, 5, 300, 4, 4, 3, 2, 1, 2)`,
  ).run();
  db.prepare('INSERT INTO stats_hourly (day, hour, views) VALUES (?, ?, ?)').run('2026-11-06', 9, 6);
  db.prepare('INSERT INTO stats_hourly (day, hour, views) VALUES (?, ?, ?)').run('2026-11-06', 20, 4);
  db.prepare('INSERT INTO stats_device (day, device, views) VALUES (?, ?, ?)').run('2026-11-06', 'mobile', 7);
  db.prepare('INSERT INTO stats_device (day, device, views) VALUES (?, ?, ?)').run('2026-11-06', 'desktop', 3);
  // Heute: ein unvollständiger Tag zählt nicht in die Verteilungen
  statsRepo.recordView({ ip: '9.9.9.9', userAgent: UA_DESKTOP, path: '/', now: T0 });

  const d = statsRepo.getDashboard({ days: 7, now: T0 });
  assert.equal(d.engagement.days, 1);
  assert.deepEqual(d.engagement.durations, { short: 4, mid: 3, long: 2, xlong: 1 });
  assert.equal(d.engagement.singleVisitors, 2);
  assert.equal(d.engagement.visitors, 5);
  assert.equal(d.hours.days, 1);
  assert.equal(d.hours.views.length, 24);
  assert.equal(d.hours.views[9], 6);
  assert.equal(d.hours.views[20], 4);
  assert.equal(d.hours.views.reduce((a, b) => a + b, 0), 10);
  assert.equal(d.devices.mobile, 7);
  assert.equal(d.devices.desktop, 3);
  assert.equal(d.devices.tablet, 0);
  assert.equal(d.availability.engagementFrom, '2026-11-06');
  assert.equal(d.availability.hoursFrom, '2026-11-06');
  assert.equal(d.availability.devicesFrom, '2026-11-06');
});

test('Auswertung ohne Phase-2-Daten: Nullen und keine Verfügbarkeit statt Fehler (AC-12)', () => {
  clear();
  db.prepare(
    "INSERT INTO stats_daily (day, path, views, visitors, total_seconds, timed_views) VALUES ('2026-11-04', '*', 50, 25, 500, 20)",
  ).run();
  const d = statsRepo.getDashboard({ days: 7, now: T0 });
  assert.equal(d.engagement.days, 0);
  assert.equal(d.hours.days, 0);
  assert.equal(d.devices.days, 0);
  assert.deepEqual(d.availability, { engagementFrom: null, hoursFrom: null, devicesFrom: null });
});

test('Auswertung: noch nicht verdichtete Tage (stats_views) werden mitgezählt', () => {
  clear();
  const yesterday = T0 - DAY;
  statsRepo.recordView({ ip: '1.1.1.1', userAgent: UA_IPHONE, path: '/', now: yesterday });
  statsRepo.recordView({ ip: '2.2.2.2', userAgent: UA_DESKTOP, path: '/', now: yesterday });
  const d = statsRepo.getDashboard({ days: 7, now: T0 });
  assert.equal(d.devices.mobile, 1);
  assert.equal(d.devices.desktop, 1);
  assert.equal(d.engagement.singleVisitors, 2);
  assert.equal(d.hours.views[10], 2);
});

test('Migration v8: Schema-Version 8 und alle neuen Spalten/Tabellen vorhanden (AC-10)', () => {
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 8);
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  for (const c of ['hour', 'device']) assert.ok(cols('stats_views').includes(c));
  for (const c of ['dur_short', 'dur_mid', 'dur_long', 'dur_xlong', 'single_visitors']) assert.ok(cols('stats_daily').includes(c));
  assert.deepEqual(cols('stats_hourly'), ['day', 'hour', 'views']);
  assert.deepEqual(cols('stats_device'), ['day', 'device', 'views']);
});

test('Migration v8 aus einer echten v7-Datenbank: Altdaten bleiben, neue Spalten kommen dazu (AC-10)', () => {
  const { execFileSync } = require('node:child_process');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-v7-'));
  const file = path.join(dir, 'events.db');
  const script = `
    const Database = require('better-sqlite3');
    const old = new Database(process.env.EVENTS_DB_PATH);
    old.exec(\`
      CREATE TABLE stats_views (id TEXT PRIMARY KEY, day TEXT NOT NULL, path TEXT NOT NULL, visitor TEXT NOT NULL,
        started_at INTEGER NOT NULL, last_ping_at INTEGER NOT NULL, seconds INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE stats_daily (day TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL, visitors INTEGER NOT NULL,
        total_seconds INTEGER NOT NULL, timed_views INTEGER NOT NULL, PRIMARY KEY (day, path));
      INSERT INTO stats_daily VALUES ('2026-10-01', '*', 12, 7, 300, 5);
      INSERT INTO stats_views VALUES ('abc', '2026-11-09', '/', 'hash', 1, 1, 0);
    \`);
    old.pragma('user_version = 7');
    old.close();
    const db = require(${JSON.stringify(path.join(__dirname, '../src/db/index'))});
    const cols = (t) => db.prepare('PRAGMA table_info(' + t + ')').all().map((c) => c.name);
    const out = {
      version: db.prepare('PRAGMA user_version').get().user_version,
      daily: db.prepare("SELECT * FROM stats_daily WHERE day = '2026-10-01'").get(),
      view: db.prepare("SELECT hour, device FROM stats_views WHERE id = 'abc'").get(),
      viewCols: cols('stats_views'),
      dailyCols: cols('stats_daily'),
      hourly: cols('stats_hourly'),
      device: cols('stats_device'),
    };
    console.log(JSON.stringify(out));
  `;
  const res = JSON.parse(
    execFileSync(process.execPath, ['-e', script], { env: { ...process.env, EVENTS_DB_PATH: file }, encoding: 'utf8' }).trim().split('\n').pop(),
  );
  assert.equal(res.version, 8);
  assert.equal(res.daily.views, 12);
  assert.equal(res.daily.visitors, 7);
  assert.equal(res.daily.dur_short, null);
  assert.deepEqual(res.view, { hour: null, device: null });
  assert.ok(res.viewCols.includes('hour') && res.viewCols.includes('device'));
  assert.ok(res.dailyCols.includes('single_visitors'));
  assert.deepEqual(res.hourly, ['day', 'hour', 'views']);
  assert.deepEqual(res.device, ['day', 'device', 'views']);
  fs.rmSync(dir, { recursive: true, force: true });
});
