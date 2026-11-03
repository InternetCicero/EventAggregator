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

function getSummary(days, now = Date.now()) {
  const today = dayOf(now);
  const from = shiftDay(today, -(days - 1));
  // Verdichtete Tage und noch nicht verdichtete Einzelaufrufe liegen auf getrennten Tagen.
  const rows = db
    .prepare(
      `SELECT day, path, views, visitors, total_seconds, timed_views FROM stats_daily WHERE day >= ?
       UNION ALL
       SELECT day, path, COUNT(*), COUNT(DISTINCT visitor), SUM(seconds), SUM(seconds > 0)
         FROM stats_views WHERE day >= ? GROUP BY day, path
       UNION ALL
       SELECT day, '*', COUNT(*), COUNT(DISTINCT visitor), SUM(seconds), SUM(seconds > 0)
         FROM stats_views WHERE day >= ? GROUP BY day`,
    )
    .all(from, from, from);

  const perDayMap = new Map();
  const pages = new Map();
  const totals = { views: 0, visitors: 0, seconds: 0, timed: 0 };
  for (const r of rows) {
    if (r.path === '*') {
      perDayMap.set(r.day, r);
      totals.views += r.views;
      totals.visitors += r.visitors;
      totals.seconds += r.total_seconds;
      totals.timed += r.timed_views;
    } else {
      const p = pages.get(r.path) || { path: r.path, views: 0, visitors: 0, seconds: 0, timed: 0 };
      p.views += r.views;
      p.visitors += r.visitors;
      p.seconds += r.total_seconds;
      p.timed += r.timed_views;
      pages.set(r.path, p);
    }
  }

  const perDay = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = shiftDay(today, -i);
    const r = perDayMap.get(day);
    perDay.push({ day, views: r ? r.views : 0, visitors: r ? r.visitors : 0 });
  }

  const topPages = [...pages.values()]
    .sort((a, b) => b.views - a.views)
    .slice(0, 20)
    .map((p) => ({ path: p.path, views: p.views, visitors: p.visitors, avgSeconds: avg(p.seconds, p.timed) }));

  return {
    days,
    // "visitors" ist die Summe der Tagesbesucher: dieselbe Person an zwei Tagen zählt zweimal.
    totals: { views: totals.views, visitors: totals.visitors, avgSeconds: avg(totals.seconds, totals.timed) },
    perDay,
    topPages,
  };
}

module.exports = { recordView, recordPing, compactOldViews, getSummary, dayOf, KEEP_VIEWS_DAYS };
