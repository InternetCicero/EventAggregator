const crypto = require('crypto');
const db = require('./index');
const { deviceClass } = require('../stats/device');

const MAX_VIEW_SECONDS = 30 * 60;
const MAX_PING_GAP_SECONDS = 20; // Pings kommen alle 15 s; längere Lücken = Tab war nicht sichtbar
const KEEP_VIEWS_DAYS = 2;
const KEEP_DAILY_DAYS = 395; // ca. 13 Monate

const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });
function dayOf(ms) {
  return dayFormat.format(new Date(ms)); // YYYY-MM-DD
}

const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' });
function hourOf(ms) {
  return Number(hourFormat.format(new Date(ms)));
}

function shiftDay(day, delta) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Tagessalz nur im Arbeitsspeicher: nach dem Tageswechsel (oder Neustart) lässt sich
// eine Kennung nicht mehr nachrechnen oder mit anderen Tagen verknüpfen.
let saltDay = null;
let salt = null;
function saltFor(day) {
  if (saltDay !== day) {
    saltDay = day;
    salt = crypto.randomBytes(32);
  }
  return salt;
}

function visitorId(ip, userAgent, day) {
  return crypto
    .createHash('sha256')
    .update(saltFor(day))
    .update(`${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 32);
}

function recordView({ ip, userAgent, path, now = Date.now() }) {
  const day = dayOf(now);
  const id = crypto.randomBytes(8).toString('hex');
  db.prepare(
    'INSERT INTO stats_views (id, day, path, visitor, started_at, last_ping_at, seconds, hour, device) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
  ).run(id, day, path, visitorId(ip, userAgent, day), now, now, hourOf(now), deviceClass(userAgent));
  return id;
}

// Gibt true zurück, wenn der Ping einem aktuellen Aufruf zugeordnet wurde.
function recordPing({ id, now = Date.now() }) {
  const row = db.prepare('SELECT last_ping_at, seconds FROM stats_views WHERE id = ?').get(id);
  if (!row) return false;
  const gap = (now - row.last_ping_at) / 1000;
  if (gap < 0 || gap > MAX_VIEW_SECONDS) return false; // zu alt oder unplausibel
  const seconds = Math.min(row.seconds + Math.min(Math.round(gap), MAX_PING_GAP_SECONDS), MAX_VIEW_SECONDS);
  db.prepare('UPDATE stats_views SET last_ping_at = ?, seconds = ? WHERE id = ?').run(now, seconds, id);
  return true;
}

// Aufrufe älter als KEEP_VIEWS_DAYS Tage zu Tageswerten verdichten und löschen,
// danach sehr alte Tageswerte entfernen. Nur stats_*-Tabellen werden berührt.
function compactOldViews(now = Date.now()) {
  const cutoff = shiftDay(dayOf(now), -KEEP_VIEWS_DAYS);
  const dailyCutoff = shiftDay(dayOf(now), -KEEP_DAILY_DAYS);
  const run = db.transaction(() => {
    db.prepare(
      `INSERT OR REPLACE INTO stats_daily (day, path, views, visitors, total_seconds, timed_views)
       SELECT day, path, COUNT(*), COUNT(DISTINCT visitor), SUM(seconds), SUM(seconds > 0)
       FROM stats_views WHERE day < ? GROUP BY day, path`,
    ).run(cutoff);
    db.prepare(
      `INSERT OR REPLACE INTO stats_daily
         (day, path, views, visitors, total_seconds, timed_views, dur_short, dur_mid, dur_long, dur_xlong, single_visitors)
       SELECT day, '*', COUNT(*), COUNT(DISTINCT visitor), SUM(seconds), SUM(seconds > 0),
         SUM(seconds < 10), SUM(seconds >= 10 AND seconds < 60), SUM(seconds >= 60 AND seconds < 300), SUM(seconds >= 300),
         (SELECT COUNT(*) FROM (SELECT visitor FROM stats_views v WHERE v.day = stats_views.day GROUP BY visitor HAVING COUNT(*) = 1))
       FROM stats_views WHERE day < ? GROUP BY day`,
    ).run(cutoff);
    db.prepare(
      `INSERT OR REPLACE INTO stats_hourly (day, hour, views)
       SELECT day, hour, COUNT(*) FROM stats_views WHERE day < ? AND hour IS NOT NULL GROUP BY day, hour`,
    ).run(cutoff);
    db.prepare(
      `INSERT OR REPLACE INTO stats_device (day, device, views)
       SELECT day, device, COUNT(*) FROM stats_views WHERE day < ? AND device IS NOT NULL GROUP BY day, device`,
    ).run(cutoff);
    const removed = db.prepare('DELETE FROM stats_views WHERE day < ?').run(cutoff).changes;
    db.prepare('DELETE FROM stats_daily WHERE day < ?').run(dailyCutoff);
    db.prepare('DELETE FROM stats_hourly WHERE day < ?').run(dailyCutoff);
    db.prepare('DELETE FROM stats_device WHERE day < ?').run(dailyCutoff);
    return removed;
  });
  return run();
}

const avg = (seconds, timed) => (timed > 0 ? Math.round(seconds / timed) : 0);

const PAGE_GROUPS = {
  '/': 'events',
  '/jobs': 'jobs',
  '/jobs/:id': 'jobs',
  '/materialien': 'materialien',
  '/materialien/:id': 'materialien',
  '/einreichen': 'einreichen',
  '/jobs/einreichen': 'einreichen',
  '/datenschutz': 'rechtliches',
  '/impressum': 'rechtliches',
};
const GROUP_ORDER = ['events', 'jobs', 'materialien', 'einreichen', 'rechtliches'];

function dayCount(from, to) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1;
}

// 1 = Montag ... 7 = Sonntag
function weekdayOf(day) {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

const round1 = (n) => Math.round(n * 10) / 10;

// Verdichtete Tage und noch nicht verdichtete Einzelaufrufe liegen auf getrennten Tagen.
function loadRows(from, to) {
  return db
    .prepare(
      `SELECT day, path, views, visitors, total_seconds, timed_views,
              dur_short, dur_mid, dur_long, dur_xlong, single_visitors
         FROM stats_daily WHERE day >= ? AND day <= ?
       UNION ALL
       SELECT day, path, COUNT(*), COUNT(DISTINCT visitor), SUM(seconds), SUM(seconds > 0),
              NULL, NULL, NULL, NULL, NULL
         FROM stats_views WHERE day >= ? AND day <= ? GROUP BY day, path
       UNION ALL
       SELECT day, '*', COUNT(*), COUNT(DISTINCT visitor), SUM(seconds), SUM(seconds > 0),
              SUM(seconds < 10), SUM(seconds >= 10 AND seconds < 60), SUM(seconds >= 60 AND seconds < 300), SUM(seconds >= 300),
              (SELECT COUNT(*) FROM (SELECT visitor FROM stats_views v WHERE v.day = stats_views.day GROUP BY visitor HAVING COUNT(*) = 1))
         FROM stats_views WHERE day >= ? AND day <= ? GROUP BY day`,
    )
    .all(from, to, from, to, from, to);
}

// Phase 2: Aufrufe je Stunde und je Gerätekategorie (nur abgeschlossene Tage), plus der erste Tag mit Daten.
function loadDistribution(table, column, from, to) {
  if (from > to) return { days: 0, rows: [] };
  const rows = db
    .prepare(
      `SELECT key, SUM(views) AS views FROM (
         SELECT day, ${column} AS key, views FROM ${table} WHERE day >= ? AND day <= ?
         UNION ALL
         SELECT day, ${column} AS key, COUNT(*) FROM stats_views
           WHERE day >= ? AND day <= ? AND ${column} IS NOT NULL GROUP BY day, ${column}
       ) GROUP BY key`,
    )
    .all(from, to, from, to);
  const { days } = db
    .prepare(
      `SELECT COUNT(DISTINCT day) AS days FROM (
         SELECT day FROM ${table} WHERE day >= ? AND day <= ?
         UNION ALL
         SELECT day FROM stats_views WHERE day >= ? AND day <= ? AND ${column} IS NOT NULL
       )`,
    )
    .get(from, to, from, to);
  return { days, rows };
}

function firstDay(sql) {
  const row = db.prepare(sql).get();
  return row && row.day ? row.day : null;
}

// Kennzahlen aus einer Liste von Tageswerten (nur abgeschlossene Tage).
function summarize(dayList) {
  const t = dayList.reduce(
    (a, d) => ({ views: a.views + d.views, visitors: a.visitors + d.visitors, seconds: a.seconds + d.seconds, timed: a.timed + d.timed }),
    { views: 0, visitors: 0, seconds: 0, timed: 0 },
  );
  return {
    days: dayList.length,
    views: t.views,
    visitors: t.visitors,
    avgSeconds: avg(t.seconds, t.timed),
    visitorsPerDay: dayList.length ? round1(t.visitors / dayList.length) : 0,
    viewsPerVisitor: t.visitors ? round1(t.views / t.visitors) : 0,
  };
}

// Auswertung für das Admin-Dashboard. Entweder `days` (letzte n Tage inkl. heute) oder `from`/`to`.
// Der heutige Tag ist noch unvollständig und fließt deshalb nicht in Durchschnitte und Vergleich ein.
function getDashboard({ days = 7, from: fromArg, to: toArg, granularity = 'day', now = Date.now() } = {}) {
  const today = dayOf(now);
  const yesterday = shiftDay(today, -1);
  const to = toArg && toArg < today ? toArg : today;
  const from = fromArg || shiftDay(to, -(days - 1));
  const n = dayCount(from, to);
  const prevFrom = shiftDay(from, -n);

  const rows = loadRows(prevFrom < yesterday ? prevFrom : yesterday, today);
  const byDay = new Map();
  const pages = new Map();
  for (const r of rows) {
    if (r.path === '*') {
      byDay.set(r.day, {
        views: r.views,
        visitors: r.visitors,
        seconds: r.total_seconds || 0,
        timed: r.timed_views || 0,
        dur: r.dur_short === null ? null : [r.dur_short, r.dur_mid, r.dur_long, r.dur_xlong],
        single: r.single_visitors,
      });
    } else if (r.day >= from && r.day <= to) {
      const p = pages.get(r.path) || { path: r.path, views: 0, visitors: 0, seconds: 0, timed: 0 };
      p.views += r.views;
      p.visitors += r.visitors;
      p.seconds += r.total_seconds || 0;
      p.timed += r.timed_views || 0;
      pages.set(r.path, p);
    }
  }
  const empty = { views: 0, visitors: 0, seconds: 0, timed: 0, dur: null, single: null };
  const dayData = (day) => ({ day, ...(byDay.get(day) || empty) });

  const rangeDays = [];
  for (let i = 0; i < n; i++) rangeDays.push(dayData(shiftDay(from, i)));
  const completedDays = rangeDays.filter((d) => d.day < today);
  const prevDays = [];
  for (let i = 0; i < n; i++) prevDays.push(dayData(shiftDay(prevFrom, i)));

  // Balken: je Tag oder je Monat
  let perDay;
  if (granularity === 'month') {
    const months = new Map();
    for (const d of rangeDays) {
      const key = d.day.slice(0, 7);
      const m = months.get(key) || { day: key, views: 0, visitors: 0, seconds: 0, timed: 0, partial: false };
      m.views += d.views;
      m.visitors += d.visitors;
      m.seconds += d.seconds;
      m.timed += d.timed;
      if (d.day === today) m.partial = true;
      months.set(key, m);
    }
    perDay = [...months.values()];
  } else {
    perDay = rangeDays.map((d) => ({ ...d, partial: d.day === today }));
  }
  perDay = perDay.map((d) => ({
    day: d.day,
    views: d.views,
    visitors: d.visitors,
    avgSeconds: avg(d.seconds, d.timed),
    partial: d.partial,
  }));

  const totals = rangeDays.reduce(
    (a, d) => ({ views: a.views + d.views, visitors: a.visitors + d.visitors, seconds: a.seconds + d.seconds, timed: a.timed + d.timed }),
    { views: 0, visitors: 0, seconds: 0, timed: 0 },
  );

  const peakDay = completedDays.reduce((best, d) => (d.visitors > (best ? best.visitors : 0) ? d : best), null);

  const groupViews = new Map(GROUP_ORDER.map((g) => [g, 0]));
  for (const p of pages.values()) {
    const g = PAGE_GROUPS[p.path];
    if (g) groupViews.set(g, groupViews.get(g) + p.views);
  }

  const weekday = [1, 2, 3, 4, 5, 6, 7].map((w) => {
    const list = completedDays.filter((d) => weekdayOf(d.day) === w);
    const sum = list.reduce((a, d) => a + d.visitors, 0);
    return { weekday: w, days: list.length, avgVisitors: list.length ? round1(sum / list.length) : 0 };
  });

  const topPages = [...pages.values()]
    .sort((a, b) => b.views - a.views)
    .slice(0, 20)
    .map((p) => ({ path: p.path, views: p.views, visitors: p.visitors, avgSeconds: avg(p.seconds, p.timed) }));

  // Phase 2: nur abgeschlossene Tage; Tage ohne Erfassung (vor dem Update) zählen nicht mit.
  const engagement = { days: 0, durations: { short: 0, mid: 0, long: 0, xlong: 0 }, singleVisitors: 0, visitors: 0 };
  for (const d of completedDays) {
    if (!d.dur) continue;
    engagement.days += 1;
    engagement.durations.short += d.dur[0];
    engagement.durations.mid += d.dur[1];
    engagement.durations.long += d.dur[2];
    engagement.durations.xlong += d.dur[3];
    engagement.singleVisitors += d.single || 0;
    engagement.visitors += d.visitors;
  }
  const lastCompleted = to < today ? to : yesterday;
  const hourData = loadDistribution('stats_hourly', 'hour', from, lastCompleted);
  const hours = { days: hourData.days, views: Array.from({ length: 24 }, () => 0) };
  for (const r of hourData.rows) if (r.key >= 0 && r.key <= 23) hours.views[r.key] = r.views;
  const deviceData = loadDistribution('stats_device', 'device', from, lastCompleted);
  const devices = { days: deviceData.days, mobile: 0, tablet: 0, desktop: 0, other: 0 };
  for (const r of deviceData.rows) if (r.key in devices && r.key !== 'days') devices[r.key] = r.views;
  const availability = {
    engagementFrom: firstDay(
      `SELECT MIN(day) AS day FROM (
         SELECT MIN(day) AS day FROM stats_daily WHERE path = '*' AND dur_short IS NOT NULL
         UNION ALL SELECT MIN(day) FROM stats_views)`,
    ),
    hoursFrom: firstDay(
      `SELECT MIN(day) AS day FROM (
         SELECT MIN(day) AS day FROM stats_hourly UNION ALL SELECT MIN(day) FROM stats_views WHERE hour IS NOT NULL)`,
    ),
    devicesFrom: firstDay(
      `SELECT MIN(day) AS day FROM (
         SELECT MIN(day) AS day FROM stats_device UNION ALL SELECT MIN(day) FROM stats_views WHERE device IS NOT NULL)`,
    ),
  };

  const dayStat = (day) => {
    const d = dayData(day);
    return { day, views: d.views, visitors: d.visitors };
  };

  return {
    days: n,
    from,
    to,
    today,
    granularity,
    // "visitors" ist die Summe der Tagesbesucher: dieselbe Person an zwei Tagen zählt zweimal.
    totals: { views: totals.views, visitors: totals.visitors, avgSeconds: avg(totals.seconds, totals.timed) },
    completed: summarize(completedDays),
    previous: summarize(prevDays),
    todayStats: dayStat(today),
    yesterdayStats: dayStat(yesterday),
    peak: peakDay && peakDay.visitors > 0 ? { day: peakDay.day, visitors: peakDay.visitors } : null,
    perDay,
    groups: GROUP_ORDER.map((key) => ({ key, views: groupViews.get(key) })),
    weekday,
    topPages,
    engagement,
    hours,
    devices,
    availability,
  };
}

function getSummary(days, now = Date.now()) {
  return getDashboard({ days, now });
}

module.exports = { hourOf, recordView, recordPing, compactOldViews, getSummary, getDashboard, dayOf, shiftDay, KEEP_VIEWS_DAYS, KEEP_DAILY_DAYS };
