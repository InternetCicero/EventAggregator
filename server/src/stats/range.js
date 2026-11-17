// Zeitraum-Parameter für die Admin-Statistik prüfen (reine Funktion, testbar).
// Erlaubt: days=7|30|90, range=12m (letzte 12 Monate, monatlich) oder from/to (höchstens 400 Tage).
const { dayOf } = require('../db/statsRepo');

const MAX_RANGE_DAYS = 400;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_BARS_FROM_DAYS = 120;

function validDay(s) {
  return typeof s === 'string' && DAY_RE.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
}

function parseStatsQuery(query, now = Date.now()) {
  const today = dayOf(now);

  if (query.from || query.to) {
    if (!validDay(query.from) || !validDay(query.to)) return { error: 'from und to müssen Datum im Format JJJJ-MM-TT sein' };
    if (query.from > query.to) return { error: 'from darf nicht nach to liegen' };
    if (query.from > today) return { error: 'from liegt in der Zukunft' };
    const to = query.to > today ? today : query.to;
    const n = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${query.from}T12:00:00Z`)) / 86400000) + 1;
    if (n > MAX_RANGE_DAYS) return { error: `Zeitraum darf höchstens ${MAX_RANGE_DAYS} Tage lang sein` };
    return { from: query.from, to, granularity: n > MONTH_BARS_FROM_DAYS ? 'month' : 'day' };
  }

  if (query.range === '12m') {
    // erster Tag des Monats vor 11 Monaten
    const [y, m] = today.split('-').map(Number);
    const total = y * 12 + (m - 1) - 11;
    const from = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
    return { from, to: today, granularity: 'month' };
  }

  const days = Number(query.days) || 7;
  if (![7, 30, 90].includes(days)) return { error: 'days muss 7, 30 oder 90 sein' };
  return { days, granularity: 'day' };
}

module.exports = { parseStatsQuery, MAX_RANGE_DAYS };
