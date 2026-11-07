// Kalendertage zwischen zwei Daten im Format JJJJ-MM-TT (Uhrzeit egal)
export function dayOf(value) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

export function daysBetween(fromDay, toDay) {
  const toUtc = (d) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toUtc(toDay) - toUtc(fromDay)) / 86400000);
}

export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
