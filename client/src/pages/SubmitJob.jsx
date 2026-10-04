import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import JobFields from '../components/JobFields';
import { emptyJobForm, missingVibe } from '../lib/jobForm';

export default function SubmitJob() {
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(emptyJobForm);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const [linkInput, setLinkInput] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkMatchInfo, setLinkMatchInfo] = useState(null);

  useEffect(() => {
    api.getJobsMeta().then(setMeta).catch((e) => setErrorMsg(e.message));
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleFetchLink() {
    if (!linkInput) return;
    setLinkLoading(true);
    setLinkError('');
    setLinkMatchInfo(null);
    try {
      const r = await api.extractJobFromLink(linkInput);
      setForm((f) => ({
        ...f,
        title: r.title || f.title,
        description: r.description || f.description,
        company_name: r.company_name || f.company_name,
        location: r.location || f.location,
        work_mode: r.work_mode || f.work_mode,
        job_type: r.job_type || f.job_type,
        deadline: r.deadline || f.deadline,
        salary_min: r.salary_min ? String(r.salary_min) : f.salary_min,
        salary_max: r.salary_max ? String(r.salary_max) : f.salary_max,
        apply_url: r.apply_url || linkInput,
      }));
      if (r.matched === 'json-ld') {
        setLinkMatchInfo('Stellenanzeige erkannt. Bitte prüfen und Vibe-Regler ergänzen.');
      } else if (r.matched === 'opengraph') {
        setLinkMatchInfo('Nur allgemeine Seiteninfos gefunden. Bitte die Felder ergänzen.');
      } else {
        setLinkMatchInfo('Keine Daten erkannt. Bitte alles manuell ausfüllen.');
      }
    } catch (err) {
      setLinkError(err.message);
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');
    try {
      await api.submitJob({ ...form, consent });
      setStatus('success');
      setForm(emptyJobForm);
      setConsent(false);
      setLinkInput('');
      setLinkMatchInfo(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  }

  const vibeMissing = missingVibe(meta, form.vibe).length;
  const canSubmit = meta && consent && vibeMissing === 0 && status !== 'sending';

  return (
    <div className="submit-page">
      <h1>Stelle einreichen</h1>
      <p className="hint">
        Praktikum, Werkstudentenjob oder Einstiegsstelle, die du empfehlen kannst? Die Stelle wird nach kurzer Prüfung
        freigeschaltet.
      </p>
      {status === 'success' && (
        <p className="success">Danke! Die Stelle wurde eingereicht und wartet auf Freigabe.</p>
      )}

      <div className="mode-panel">
        <p className="hint">Optional: Link zur Stellenanzeige einfügen, die Daten werden automatisch vorausgefüllt.</p>
        <div className="link-input-row">
          <input
            type="url"
            placeholder="https://karriere.beispiel.de/praktikum"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
          />
          <button type="button" onClick={handleFetchLink} disabled={linkLoading || !linkInput}>
            {linkLoading ? 'Lädt…' : 'Daten abrufen'}
          </button>
        </div>
        {linkError && <p className="error">Fehler: {linkError}</p>}
        {linkMatchInfo && <p className="hint">{linkMatchInfo}</p>}
      </div>

      <form className="event-form job-form" onSubmit={handleSubmit}>
        <JobFields form={form} update={update} meta={meta} />

        <h2 className="form-section">6. Abschluss</h2>
        <label>
          Dein Name (optional, nur für die Moderation)
          <input value={form.submitter_name} onChange={(e) => update('submitter_name', e.target.value)} />
        </label>
        <p className="hint">
          Bitte keine Angaben zu Alter, Geschlecht oder Herkunft (z. B. „junges Team“), sondern lieber zur Karrierestufe
          (z. B. „viele Berufseinsteiger“).
        </p>
        <label className="checkbox-label">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Die hier genannten Personen sind mit der Veröffentlichung einverstanden. Details in der{' '}
            <Link to="/datenschutz">Datenschutzerklärung</Link>. *
          </span>
        </label>

        <button type="submit" disabled={!canSubmit}>
          {status === 'sending' ? 'Wird gesendet…' : 'Stelle einreichen'}
        </button>
        {meta && vibeMissing > 0 && (
          <p className="hint">Zum Einreichen bitte alle {meta.dimensions.length} Vibe-Regler setzen.</p>
        )}
        {meta && vibeMissing === 0 && !consent && <p className="hint">Zum Einreichen bitte die Einwilligung bestätigen.</p>}
        {status === 'error' && <p className="error">Fehler: {errorMsg}</p>}
      </form>
    </div>
  );
}
