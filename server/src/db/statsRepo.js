const crypto = require('crypto');
const db = require('./index');

const MAX_VIEW_SECONDS = 30 * 60;
const MAX_PING_GAP_SECONDS = 20; // Pings kommen alle 15 s; längere Lücken = Tab war nicht sichtbar
const KEEP_VIEWS_DAYS = 2;
const KEEP_DAILY_DAYS = 395; // ca. 13 Monate

const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });
function dayOf(ms) {
  return dayFormat.format(new Date(ms)); // YYYY-MM-DD
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
    'INSERT INTO stats_views (id, day, path, visitor, started_at, last_ping_at, seconds) VALUES (?, ?, ?, ?, ?, ?, 0)',
  ).run(id, day, path, visitorId(ip, userAgent, day), now, now);
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
      `INSERT OR REPLACE INTO stats_daily (day, path, views, visitors, total_seconds, timed_views)
       SELECT day, '*', COUNT(*), COUNT(DISTINCT visitor), SUM(seconds), SUM(seconds > 0)
       FROM stats_views WHERE day < ? GROUP BY day`,
    ).run(cutoff);
    const removed = db.prepare('DELETE FROM stats_views WHERE day < ?').run(cutoff).changes;
    db.prepare('DELETE FROM stats_daily WHERE day < ?').run(dailyCutoff);
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
      `SELECT day, path, views, visitors, total_seconds, timed_views FROM stats_daily WHERE day >= ? AND day <= ?
       UNION ALL
       SELECT day, path, COUNT(*), COUNT(DISTINCT visitor), SUM(seconds), SUM(seconds > 0)
         FROM stats_views WHERE day >= ? AND day <= ? GROUP BY day, path
       UNION ALL
       SELECT day, '*', COUNT(*), COUNT(DISTINCT visitor), SUM(seconds), SUM(seconds > 0)
         FROM stats_views WHERE day >= ? AND day <= ? GROUP BY day`,
    )
    .all(from, to, from, to, from, to);
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
      byDay.set(r.day, { views: r.views, visitors: r.visitors, seconds: r.total_seconds || 0, timed: r.timed_views || 0 });
    } else if (r.day >= from && r.day <= to) {
      const p = pages.get(r.path) || { path: r.path, views: 0, visitors: 0, seconds: 0, timed: 0 };
      p.views += r.views;
      p.visitors += r.visitors;
      p.seconds += r.total_seconds || 0;
      p.timed += r.timed_views || 0;
      pages.set(r.path, p);
    }
  }
  const empty = { views: 0, visitors: 0, seconds: 0, timed: 0 };
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
  };
}

function getSummary(days, now = Date.now()) {
  return getDashboard({ days, now });
}

module.exports = { recordView, recordPing, compactOldViews, getSummary, getDashboard, dayOf, shiftDay, KEEP_VIEWS_DAYS, KEEP_DAILY_DAYS };
