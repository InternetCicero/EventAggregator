// Anzeigetexte für die festen Werte der Jobs-API (Werte siehe
// server/src/jobs/validateJob.js).
export const DEGREE_LABELS = {
  bachelor: 'Bachelor',
  master: 'Master',
  beides: 'Bachelor oder Master',
  egal: 'Abschluss egal',
};

export const WORK_MODE_LABELS = {
  onsite: 'Vor Ort',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

export const PAID_LABELS = {
  yes: 'Bezahlt',
  no: 'Unbezahlt',
  unknown: 'Bezahlung k. A.',
};

export const SIZE_LABELS = {
  '1-50': '1–50 Mitarbeitende',
  '51-250': '51–250 Mitarbeitende',
  '251-1000': '251–1.000 Mitarbeitende',
  '1000+': 'über 1.000 Mitarbeitende',
};

export function jobTypeLabel(meta, value) {
  return meta?.jobTypes?.find((t) => t.value === value)?.label || value;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatSalary(job) {
  const fmt = (n) => n.toLocaleString('de-DE');
  if (job.salary_min && job.salary_max && job.salary_min !== job.salary_max) {
    return `${fmt(job.salary_min)}–${fmt(job.salary_max)} € / Monat`;
  }
  const single = job.salary_min || job.salary_max;
  return single ? `${fmt(single)} € / Monat` : null;
}

// Fakten-Chips werden aus den Feldern abgeleitet, nicht gespeichert (Spec 3.4)
export function factChips(job) {
  const chips = [];
  if (job.paid === 'yes') chips.push('Bezahlt');
  if (job.paid === 'no') chips.push('Unbezahlt');
  const salary = formatSalary(job);
  if (salary) chips.push(salary);
  if (job.languages?.includes('en')) chips.push('Englisch möglich');
  if (job.work_mode === 'remote') chips.push('Remote möglich');
  if (job.work_mode === 'hybrid') chips.push('Hybrid');
  if (job.contact_decides) chips.push('Ansprechpartner entscheidet mit');
  return chips;
}
