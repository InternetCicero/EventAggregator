// Prüft und normalisiert eine Stellen-Einreichung. Reine Funktion ohne
// DB-Zugriff, damit die Regeln aus der Spec (AC-2 bis AC-7) einzeln testbar
// sind. Gibt { errors, job } zurück: errors ist leer, wenn alles passt, job
// enthält nur bekannte, bereinigte Felder.
const jobTypes = require('../db/jobTypes');
const languages = require('../db/languages');
const { dimensions, questions, ANSWER_MAX_LENGTH, REFERRER_NOTE_MAX_LENGTH } = require('../db/vibe');

const DEGREE_LEVELS = ['bachelor', 'master', 'beides', 'egal'];
const WORK_MODES = ['onsite', 'hybrid', 'remote'];
const PAID_VALUES = ['yes', 'no', 'unknown'];
const SOURCE_KINDS = ['admin', 'company', 'member'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function int(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeLanguages(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  const known = new Set(languages.map((l) => l.value));
  return [...new Set(list.map((l) => String(l).trim().toLowerCase()).filter((l) => known.has(l)))];
}

// requireConsent: bei öffentlichen Einreichungen Pflicht (AC-6), beim
// Bearbeiten durch den Admin nicht (die Einwilligung liegt dann schon vor).
function validateJob(input = {}, { requireConsent = true } = {}) {
  const errors = [];

  const job = {
    title: str(input.title),
    company_name: str(input.company_name),
    description: str(input.description),
    job_type: str(input.job_type),
    degree_level: str(input.degree_level),
    min_semester: int(input.min_semester),
    location: str(input.location),
    work_mode: str(input.work_mode),
    start_date: str(input.start_date),
    duration_months: int(input.duration_months),
    paid: str(input.paid) || 'unknown',
    salary_min: int(input.salary_min),
    salary_max: int(input.salary_max),
    languages: normalizeLanguages(input.languages).join(','),
    apply_url: str(input.apply_url),
    apply_email: str(input.apply_email),
    deadline: str(input.deadline),
    referrer_name: str(input.referrer_name),
    referrer_note: str(input.referrer_note),
    contact_name: str(input.contact_name),
    contact_role: str(input.contact_role),
    contact_decides:
      input.contact_decides === undefined || input.contact_decides === null || input.contact_decides === ''
        ? null
        : bool(input.contact_decides)
          ? 1
          : 0,
    contact_consent: bool(input.contact_consent) ? 1 : 0,
    contact_email: str(input.contact_email),
    source_kind: str(input.source_kind) || 'member',
    submitter_name: str(input.submitter_name),
  };

  // Pflichtfelder (AC-2)
  if (!job.title) errors.push('Titel fehlt');
  if (!job.company_name) errors.push('Firmenname fehlt');
  if (!job.job_type) errors.push('Stellenart fehlt');
  else if (!jobTypes.some((t) => t.value === job.job_type)) errors.push('Ungültige Stellenart');
  if (!job.apply_url && !job.apply_email) errors.push('Bewerbungslink oder Bewerbungs-E-Mail fehlt');
  if (job.apply_url && !isHttpUrl(job.apply_url)) errors.push('Bewerbungslink muss mit http(s):// beginnen');
  if (job.apply_email && !EMAIL_RE.test(job.apply_email)) errors.push('Bewerbungs-E-Mail ist ungültig');

  // Auswahlfelder
  if (job.degree_level && !DEGREE_LEVELS.includes(job.degree_level)) errors.push('Ungültiger Abschluss');
  if (job.work_mode && !WORK_MODES.includes(job.work_mode)) errors.push('Ungültiges Arbeitsmodell');
  if (!PAID_VALUES.includes(job.paid)) errors.push('Ungültige Angabe zur Bezahlung');
  if (!SOURCE_KINDS.includes(job.source_kind)) errors.push('Ungültige Herkunft');

  // Zahlen und Daten
  for (const [field, label] of [
    ['min_semester', 'Mindestsemester'],
    ['duration_months', 'Dauer'],
    ['salary_min', 'Gehalt (von)'],
    ['salary_max', 'Gehalt (bis)'],
  ]) {
    if (Number.isNaN(job[field]) || (job[field] !== null && job[field] < 0)) {
      errors.push(`${label} muss eine positive ganze Zahl sein`);
    }
  }
  if (job.salary_min !== null && job.salary_max !== null && job.salary_min > job.salary_max) {
    errors.push('Gehalt (von) darf nicht größer als Gehalt (bis) sein'); // AC-7
  }
  for (const [field, label] of [
    ['start_date', 'Startdatum'],
    ['deadline', 'Bewerbungsfrist'],
  ]) {
    if (job[field] && !DATE_RE.test(job[field])) errors.push(`${label} muss im Format JJJJ-MM-TT sein`);
  }

  // Vibe-Regler: optional; gesetzte Werte müssen ganze Zahlen 1–5 sein,
  // unbekannte Keys fallen weg (AC-3)
  const rawVibe = input.vibe && typeof input.vibe === 'object' ? input.vibe : {};
  const vibe = {};
  const invalid = [];
  for (const { key } of dimensions) {
    const raw = rawVibe[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const value = Number(raw);
    if (Number.isInteger(value) && value >= 1 && value <= 5) vibe[key] = value;
    else invalid.push(key);
  }
  if (invalid.length) errors.push(`Vibe-Regler ungültig (erlaubt sind 1–5): ${invalid.join(', ')}`);
  job.vibe = vibe;

  // Leitfragen: optional, max. 280 Zeichen (AC-4)
  const rawAnswers = input.answers && typeof input.answers === 'object' ? input.answers : {};
  const answers = {};
  for (const { key, label } of questions) {
    const answer = str(rawAnswers[key]);
    if (!answer) continue;
    if (answer.length > ANSWER_MAX_LENGTH) errors.push(`Antwort zu „${label}“ ist länger als ${ANSWER_MAX_LENGTH} Zeichen`);
    answers[key] = answer;
  }
  job.answers = answers;

  if (job.referrer_note && job.referrer_note.length > REFERRER_NOTE_MAX_LENGTH) {
    errors.push(`Empfehlungsnotiz ist länger als ${REFERRER_NOTE_MAX_LENGTH} Zeichen`); // AC-4
  }

  // Kontakt-E-Mail nur mit ausdrücklicher Einwilligung speichern (AC-5)
  if (job.contact_email && !EMAIL_RE.test(job.contact_email)) errors.push('Kontakt-E-Mail ist ungültig');
  if (!job.contact_consent) job.contact_email = null;

  // Einwilligung der genannten Personen (AC-6)
  if (requireConsent && !bool(input.consent)) {
    errors.push('Bitte bestätige, dass die genannten Personen mit der Veröffentlichung einverstanden sind');
  }

  return { errors, job };
}

module.exports = { validateJob, DEGREE_LEVELS, WORK_MODES, PAID_VALUES, SOURCE_KINDS };
