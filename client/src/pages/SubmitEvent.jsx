import { useEffect, useState } from 'react';
import { api } from '../api';

const initialForm = {
  title: '',
  description: '',
  category: '',
  start_date: '',
  end_date: '',
  location: '',
  url: '',
  tags: '',
  submitter_name: '',
};

export default function SubmitEvent() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');
    try {
      await api.submitEvent({
        ...form,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setStatus('success');
      setForm(initialForm);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  }

  return (
    <div className="submit-page">
      <h1>Event einreichen</h1>
      <p className="hint">
        Dein Event wird nach kurzer Prüfung freigeschaltet und erscheint dann in der Übersicht.
      </p>

      <form className="event-form" onSubmit={handleSubmit}>
        <label>
          Titel *
          <input required value={form.title} onChange={(e) => update('title', e.target.value)} />
        </label>

        <label>
          Beschreibung
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </label>

        <label>
          Kategorie *
          <select required value={form.category} onChange={(e) => update('category', e.target.value)}>
            <option value="" disabled>
              Bitte wählen…
            </option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="form-row">
          <label>
            Start *
            <input
              required
              type="datetime-local"
              value={form.start_date}
              onChange={(e) => update('start_date', e.target.value)}
            />
          </label>
          <label>
            Ende
            <input
              type="datetime-local"
              value={form.end_date}
              onChange={(e) => update('end_date', e.target.value)}
            />
          </label>
        </div>

        <label>
          Ort
          <input value={form.location} onChange={(e) => update('location', e.target.value)} />
        </label>

        <label>
          Link (z. B. zur Veranstalter-Seite)
          <input type="url" value={form.url} onChange={(e) => update('url', e.target.value)} />
        </label>

        <label>
          Tags (mit Komma getrennt)
          <input
            placeholder="z. B. open air, gratis, familienfreundlich"
            value={form.tags}
            onChange={(e) => update('tags', e.target.value)}
          />
        </label>

        <label>
          Dein Name (optional)
          <input value={form.submitter_name} onChange={(e) => update('submitter_name', e.target.value)} />
        </label>

        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Wird gesendet…' : 'Event einreichen'}
        </button>

        {status === 'success' && (
          <p className="success">Danke! Dein Event wurde eingereicht und wartet auf Freigabe.</p>
        )}
        {status === 'error' && <p className="error">Fehler: {errorMsg}</p>}
      </form>
    </div>
  );
}
