// Rechenfunktionen für das Statistik-Dashboard (Spec 2026-11-16-statistik-dashboard).
// Rein und ohne React, damit sie sich ohne Browser testen lassen.

// Unter dieser Zahl Besucher in der Vorperiode ist ein Prozentwert nicht aussagekräftig.
export const MIN_PREVIOUS_VISITORS = 10;

const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

export const formatInt = (n) => nf.format(n);
export const formatDecimal = (n) => nf1.format(n);

// Kurzform für Beschriftungen über schmalen Balken: 1.234 -> "1,2k"
export function formatCompact(n) {
  if (n < 1000) return nf.format(n);
  if (n < 1000000) return `${nf1.format(n / 1000)}k`;
  return `${nf1.format(n / 1000000)}M`;
}

// Zeitraum-Auswahl als Abfrage für die Admin-Route
export function rangeQuery(range) {
  if (range.kind === '12m') return 'range=12m';
  if (range.kind === 'custom') return `from=${range.from}&to=${range.to}`;
  return `days=${range.days}`;
}

export function formatDuration(seconds) {
  if (!seconds) return '–';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} Min ${s} s` : `${s} s`;
}

// Prozentuale Veränderung; null, wenn die Vorperiode zu klein oder leer ist.
export function percentChange(current, previous, previousVisitors = Infinity) {
  if (!previous || previous <= 0) return null;
  if (previousVisitors < MIN_PREVIOUS_VISITORS) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function formatChange(pct) {
  if (pct === null || pct === undefined) return 'kein Vergleich';
  if (pct === 0) return '±0 %';
  return `${pct > 0 ? '+' : '−'}${formatInt(Math.abs(pct))} %`;
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WEEKDAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function parseDay(day) {
  return new Date(`${day}T12:00:00Z`);
}

export function isWeekend(day) {
  const w = parseDay(day).getUTCDay();
  return w === 0 || w === 6;
}

// "11.11." oder, bei Monaten (JJJJ-MM), "Nov 26"
export function shortLabel(day) {
  if (day.length === 7) {
    const names = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const [y, m] = day.split('-');
    return `${names[Number(m) - 1]} ${y.slice(2)}`;
  }
  const [, m, d] = day.split('-');
  return `${Number(d)}.${Number(m)}.`;
}

export function weekdayLabel(day) {
  return WEEKDAYS[parseDay(day).getUTCDay()];
}

export function fullLabel(day) {
  if (day.length === 7) return shortLabel(day);
  const [y, m, d] = day.split('-');
  return `${weekdayLabel(day)}, ${d}.${m}.${y}`;
}

// Rundet das Maximum auf einen "schönen" Wert für die Y-Achse (1, 2, 5 × 10^n).
export function niceMax(value) {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

// Welche Balken bekommen eine Datumsbeschriftung? Höchstens etwa maxLabels Stück.
export function labelEvery(count, maxLabels = 10) {
  return Math.max(1, Math.ceil(count / maxLabels));
}

// Anteile der Seitengruppen in Prozent (ganze Zahlen, Summe 100, wenn es Aufrufe gibt).
export function groupShares(groups) {
  const total = groups.reduce((a, g) => a + g.views, 0);
  if (total === 0) return groups.map((g) => ({ ...g, percent: 0 }));
  const raw = groups.map((g) => ({ ...g, exact: (g.views / total) * 100 }));
  const out = raw.map((g) => ({ ...g, percent: Math.floor(g.exact) }));
  let rest = 100 - out.reduce((a, g) => a + g.percent, 0);
  [...out]
    .sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))
    .forEach((g) => {
      if (rest > 0) {
        g.percent += 1;
        rest -= 1;
      }
    });
  return out.map(({ exact: _exact, ...g }) => g);
}

// Hinweis, wenn eine Auswertung erst ab einem bestimmten Tag erfasst wird (Phase 2).
// from: erster Tag mit Daten (oder null), rangeFrom: Beginn des gewählten Zeitraums.
export function availabilityNote(from, rangeFrom, hasData) {
  if (!from) return 'Noch keine Daten. Die Auswertung füllt sich ab dem ersten abgeschlossenen Tag nach dem Update.';
  if (!hasData) return `Im gewählten Zeitraum noch keine Daten (erfasst ab ${shortLabel(from)}).`;
  if (from > rangeFrom) return `Daten erst ab ${shortLabel(from)} verfügbar, davor wurde das nicht erfasst.`;
  return null;
}

// Stunde mit den meisten Aufrufen; null, wenn es keine gibt.
export function peakHour(hours) {
  let best = -1;
  let max = 0;
  hours.forEach((v, h) => {
    if (v > max) {
      max = v;
      best = h;
    }
  });
  return best < 0 ? null : best;
}

export function percentOf(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
