// Formularzustand für Stellen (geteilt von SubmitJob und Admin-Bearbeitung).

export const emptyJobForm = {
  title: '',
  company_name: '',
  description: '',
  job_type: '',
  degree_level: 'egal',
  min_semester: '',
  location: '',
  work_mode: '',
  start_date: '',
  duration_months: '',
  paid: 'unknown',
  salary_min: '',
  salary_max: '',
  languages: ['de'],
  apply_url: '',
  apply_email: '',
  deadline: '',
  vibe: {},
  answers: {},
  referrer_name: '',
  referrer_note: '',
  contact_name: '',
  contact_role: '',
  contact_decides: '',
  contact_email: '',
  contact_consent: false,
  submitter_name: '',
};

// API-Objekt (Zahlen/null) -> Formularzustand (Strings), für das Bearbeiten
export function jobToForm(job) {
  const form = { ...emptyJobForm };
  for (const key of Object.keys(emptyJobForm)) {
    const value = job[key];
    if (value === null || value === undefined) continue;
    form[key] = typeof emptyJobForm[key] === 'string' ? String(value) : value;
  }
  form.contact_consent = !!job.contact_consent;
  form.contact_decides = job.contact_decides === null || job.contact_decides === undefined ? '' : String(job.contact_decides);
  return form;
}

export function missingVibe(meta, vibe) {
  return (meta?.dimensions || []).filter((d) => !vibe[d.key]);
}
