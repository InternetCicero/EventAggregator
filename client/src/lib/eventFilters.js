// Filterzustand der Event-Übersicht und Schnellauswahl für Zeiträume.

export const emptyEventFilters = {
  search: '',
  category: '',
  format: '',
  tag: '',
  from: '',
  to: '',
};

export const RANGE_LABELS = {
  week: 'Diese Woche',
  month: 'Dieser Monat',
  quarter: '3 Monate',
};

function toIso(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Zeitraum ab heute; "Diese Woche" endet am Sonntag
export function rangeDates(range, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  if (range === 'week') end.setDate(start.getDate() + ((7 - start.getDay()) % 7));
  else if (range === 'month') end.setMonth(start.getMonth() + 1, 0);
  else if (range === 'quarter') end.setMonth(start.getMonth() + 3);
  else return { from: '', to: '' };
  return { from: toIso(start), to: toIso(end) };
}

// Welche Schnellauswahl entspricht genau from/to? (für Umschalter und Chip)
export function matchingRange(from, to) {
  if (!from || !to) return null;
  return Object.keys(RANGE_LABELS).find((r) => {
    const d = rangeDates(r);
    return d.from === from && d.to === to;
  }) || null;
}
