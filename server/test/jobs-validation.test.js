// Validierungsregeln der Stellen-Einreichung (Spec AC-2 bis AC-7).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateJob } = require('../src/jobs/validateJob');
const { makeJobInput, fullVibe } = require('./helpers/jobFixture');

test('gültige Einreichung hat keine Fehler', () => {
  const { errors, job } = validateJob(makeJobInput());
  assert.deepEqual(errors, []);
  assert.equal(job.title, 'Praktikum Strategy');
});

test('AC-2: Pflichtfelder Titel, Firma, Stellenart fehlen', () => {
  const { errors } = validateJob(makeJobInput({ title: '', company_name: '  ', job_type: undefined }));
  assert.ok(errors.includes('Titel fehlt'));
  assert.ok(errors.includes('Firmenname fehlt'));
  assert.ok(errors.includes('Stellenart fehlt'));
});

test('AC-2: unbekannte Stellenart wird abgelehnt', () => {
  const { errors } = validateJob(makeJobInput({ job_type: 'festanstellung-vorstand' }));
  assert.ok(errors.includes('Ungültige Stellenart'));
});

test('AC-2: weder Bewerbungslink noch -E-Mail', () => {
  const { errors } = validateJob(makeJobInput({ apply_url: '', apply_email: '' }));
  assert.ok(errors.some((e) => e.includes('Bewerbungslink oder Bewerbungs-E-Mail')));
});

test('AC-2: Bewerbungs-E-Mail allein reicht', () => {
  const { errors } = validateJob(makeJobInput({ apply_url: '', apply_email: 'jobs@example.com' }));
  assert.deepEqual(errors, []);
});

test('AC-2: Bewerbungslink muss http(s) sein', () => {
  const { errors } = validateJob(makeJobInput({ apply_url: 'javascript:alert(1)' }));
  assert.ok(errors.some((e) => e.includes('http(s)')));
});

test('AC-3: Vibe-Regler sind optional, fehlende Regler sind kein Fehler', () => {
  const vibe = fullVibe();
  delete vibe.social;
  const { errors, job } = validateJob(makeJobInput({ vibe }));
  assert.deepEqual(errors, []);
  assert.equal(job.vibe.social, undefined);
  assert.equal(Object.keys(job.vibe).length, 6);
});

test('AC-3: ganz ohne vibe-Objekt gültig', () => {
  const { errors, job } = validateJob(makeJobInput({ vibe: undefined }));
  assert.deepEqual(errors, []);
  assert.deepEqual(job.vibe, {});
});

test('AC-3: leere Werte gelten als "keine Angabe"', () => {
  const { errors, job } = validateJob(makeJobInput({ vibe: { structure: '', guidance: null, language: 4 } }));
  assert.deepEqual(errors, []);
  assert.deepEqual(job.vibe, { language: 4 });
});

test('AC-3: gesetzte Werte außerhalb 1–5 und Kommazahlen sind ungültig', () => {
  for (const bad of [0, 6, 2.5, 'abc']) {
    const { errors } = validateJob(makeJobInput({ vibe: { structure: bad } }));
    assert.ok(errors.some((e) => e.includes('structure')), `Wert ${bad} hätte abgelehnt werden müssen`);
  }
});

test('AC-3: unbekannte Vibe-Keys werden verworfen', () => {
  const { errors, job } = validateJob(makeJobInput({ vibe: { ...fullVibe(), coolness: 5 } }));
  assert.deepEqual(errors, []);
  assert.equal(job.vibe.coolness, undefined);
  assert.equal(Object.keys(job.vibe).length, 7);
});

test('AC-4: Leitfragen-Antwort über 280 Zeichen', () => {
  const { errors } = validateJob(makeJobInput({ answers: { week2: 'x'.repeat(281) } }));
  assert.ok(errors.some((e) => e.includes('280')));
});

test('AC-4: genau 280 Zeichen sind erlaubt, leere Antworten fallen weg', () => {
  const { errors, job } = validateJob(makeJobInput({ answers: { week2: 'x'.repeat(280), not_for: '  ' } }));
  assert.deepEqual(errors, []);
  assert.deepEqual(Object.keys(job.answers), ['week2']);
});

test('AC-4: Empfehlungsnotiz über 400 Zeichen', () => {
  const { errors } = validateJob(makeJobInput({ referrer_note: 'y'.repeat(401) }));
  assert.ok(errors.some((e) => e.includes('400')));
});

test('AC-5: Kontakt-E-Mail ohne Einwilligung wird verworfen', () => {
  const { errors, job } = validateJob(makeJobInput({ contact_email: 'lisa@example.com', contact_consent: false }));
  assert.deepEqual(errors, []);
  assert.equal(job.contact_email, null);
});

test('AC-5: Kontakt-E-Mail mit Einwilligung bleibt erhalten', () => {
  const { job } = validateJob(makeJobInput({ contact_email: 'lisa@example.com', contact_consent: true }));
  assert.equal(job.contact_email, 'lisa@example.com');
  assert.equal(job.contact_consent, 1);
});

test('AC-6: ohne Einwilligung der genannten Personen abgelehnt', () => {
  const { errors } = validateJob(makeJobInput({ consent: false }));
  assert.ok(errors.some((e) => e.includes('einverstanden')));
});

test('AC-6: Admin-Bearbeitung braucht keine erneute Einwilligung', () => {
  const { errors } = validateJob(makeJobInput({ consent: undefined }), { requireConsent: false });
  assert.deepEqual(errors, []);
});

test('AC-7: Gehalt von > bis', () => {
  const { errors } = validateJob(makeJobInput({ salary_min: 2000, salary_max: 1500 }));
  assert.ok(errors.some((e) => e.includes('Gehalt (von)')));
});

test('Sprachen: nur bekannte, ohne Duplikate, kleingeschrieben', () => {
  const { job } = validateJob(makeJobInput({ languages: ['DE', 'en', 'en', 'klingonisch'] }));
  assert.equal(job.languages, 'de,en');
});
