import { VibeInput } from './VibeSliders';
import { DEGREE_LABELS, PAID_LABELS, WORK_MODE_LABELS } from '../lib/jobLabels';

// Gemeinsame Formularfelder für "Stelle einreichen" und die Bearbeitung im
// Admin-Bereich. Der Zustand liegt beim Aufrufer (form/update).

function CharCount({ value, max }) {
  const len = (value || '').length;
  return <span className={len > max ? 'char-count is-over' : 'char-count'}>{len}/{max}</span>;
}

export default function JobFields({ form, update, meta }) {
  if (!meta) return <p className="hint">Lade Formular…</p>;

  function toggleLanguage(code) {
    const set = new Set(form.languages);
    if (set.has(code)) set.delete(code);
    else set.add(code);
    update('languages', [...set]);
  }

  return (
    <>
      <h2 className="form-section">1. Die Stelle</h2>
      <label>
        Titel *
        <input required value={form.title} onChange={(e) => update('title', e.target.value)} />
      </label>
      <div className="form-row">
        <label>
          Firma *
          <input required value={form.company_name} onChange={(e) => update('company_name', e.target.value)} />
        </label>
        <label>
          Stellenart *
          <select required value={form.job_type} onChange={(e) => update('job_type', e.target.value)}>
            <option value="" disabled>
              Bitte wählen…
            </option>
            {meta.jobTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Beschreibung
        <textarea rows={6} value={form.description} onChange={(e) => update('description', e.target.value)} />
      </label>

      <h2 className="form-section">2. Rahmen</h2>
      <div className="form-row">
        <label>
          Abschluss
          <select value={form.degree_level} onChange={(e) => update('degree_level', e.target.value)}>
            {Object.entries(DEGREE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ab Fachsemester
          <input
            type="number"
            min="1"
            max="20"
            value={form.min_semester}
            onChange={(e) => update('min_semester', e.target.value)}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Ort
          <input value={form.location} onChange={(e) => update('location', e.target.value)} />
        </label>
        <label>
          Arbeitsmodell
          <select value={form.work_mode} onChange={(e) => update('work_mode', e.target.value)}>
            <option value="">Keine Angabe</option>
            {Object.entries(WORK_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Start (leer = flexibel)
          <input type="date" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} />
        </label>
        <label>
          Dauer in Monaten
          <input
            type="number"
            min="1"
            max="60"
            value={form.duration_months}
            onChange={(e) => update('duration_months', e.target.value)}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Bezahlung
          <select value={form.paid} onChange={(e) => update('paid', e.target.value)}>
            {Object.entries(PAID_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {value === 'unknown' ? 'Keine Angabe' : label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Gehalt von (€ brutto / Monat)
          <input type="number" min="0" value={form.salary_min} onChange={(e) => update('salary_min', e.target.value)} />
        </label>
        <label>
          bis
          <input type="number" min="0" value={form.salary_max} onChange={(e) => update('salary_max', e.target.value)} />
        </label>
      </div>
      <fieldset className="inline-fieldset">
        <legend>Arbeitssprachen</legend>
        {meta.languages.map((l) => (
          <label key={l.value} className="checkbox-label">
            <input type="checkbox" checked={form.languages.includes(l.value)} onChange={() => toggleLanguage(l.value)} />
            {l.label}
          </label>
        ))}
      </fieldset>
      <div className="form-row">
        <label>
          Bewerbungslink
          <input
            type="url"
            placeholder="https://…"
            value={form.apply_url}
            onChange={(e) => update('apply_url', e.target.value)}
          />
        </label>
        <label>
          oder Bewerbungs-E-Mail
          <input type="email" value={form.apply_email} onChange={(e) => update('apply_email', e.target.value)} />
        </label>
      </div>
      <label>
        Bewerbungsfrist
        <input type="date" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} />
      </label>

      <h2 className="form-section">3. Vibe (optional)</h2>
      <p className="hint">
        Wo liegt die Stelle zwischen den beiden Polen? Es gibt kein Richtig oder Falsch. Ehrliche Angaben helfen
        Bewerber:innen, einzuschätzen, ob sie hineinpassen. Regler, zu denen du nichts weißt, einfach leer lassen. Ein
        zweiter Klick auf die gewählte Stufe hebt sie wieder auf.
      </p>
      <VibeInput dimensions={meta.dimensions} value={form.vibe} onChange={(v) => update('vibe', v)} />

      <h2 className="form-section">4. Leitfragen (optional)</h2>
      <p className="hint">Kurz und konkret, maximal {meta.answerMaxLength} Zeichen pro Antwort.</p>
      {meta.questions.map((q) => (
        <label key={q.key}>
          <span className="label-row">
            {q.label}
            <CharCount value={form.answers[q.key]} max={meta.answerMaxLength} />
          </span>
          <textarea
            rows={2}
            value={form.answers[q.key] || ''}
            onChange={(e) => update('answers', { ...form.answers, [q.key]: e.target.value })}
          />
        </label>
      ))}

      <h2 className="form-section">5. Empfehlung & Kontakt</h2>
      <div className="form-row">
        <label>
          Empfohlen von (Name)
          <input value={form.referrer_name} onChange={(e) => update('referrer_name', e.target.value)} />
        </label>
      </div>
      <label>
        <span className="label-row">
          Warum ich diese Stelle empfehle
          <CharCount value={form.referrer_note} max={meta.referrerNoteMaxLength} />
        </span>
        <textarea rows={3} value={form.referrer_note} onChange={(e) => update('referrer_note', e.target.value)} />
      </label>
      <div className="form-row">
        <label>
          Ansprechpartner:in
          <input value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} />
        </label>
        <label>
          Rolle
          <input
            placeholder="z. B. Teamlead Strategy"
            value={form.contact_role}
            onChange={(e) => update('contact_role', e.target.value)}
          />
        </label>
        <label>
          Entscheidet mit?
          <select value={form.contact_decides} onChange={(e) => update('contact_decides', e.target.value)}>
            <option value="">Keine Angabe</option>
            <option value="1">Ja</option>
            <option value="0">Nein</option>
          </select>
        </label>
      </div>
      <label>
        E-Mail der Ansprechperson (optional)
        <input type="email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} />
      </label>
      {form.contact_email && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.contact_consent}
            onChange={(e) => update('contact_consent', e.target.checked)}
          />
          Die Ansprechperson ist einverstanden, dass ihre E-Mail-Adresse öffentlich angezeigt wird.
        </label>
      )}
    </>
  );
}
