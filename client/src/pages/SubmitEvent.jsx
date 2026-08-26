import { useEffect, useRef, useState } from 'react';
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

const MODES = [
  { key: 'link', label: 'Link', hint: 'Events-Seite verlinken — die Daten werden automatisch ausgelesen' },
  { key: 'screenshot', label: 'Screenshot', hint: 'Bild hochladen, Text wird per OCR erkannt und zur Übertragung in das Formular angezeigt' },
  { key: 'form', label: 'Formular', hint: 'Alle Angaben direkt eintragen' },
];

function EventFields({ form, update, categories }) {
  return (
    <>
      <label>
        Titel *
        <input required value={form.title} onChange={(e) => update('title', e.target.value)} />
      </label>

      <label>
        Beschreibung
        <textarea rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} />
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
          <input type="datetime-local" value={form.end_date} onChange={(e) => update('end_date', e.target.value)} />
        </label>
      </div>

      <label>
        Ort
        <input value={form.location} onChange={(e) => update('location', e.target.value)} />
      </label>

      <label>
        Anmeldungslink
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
        Ihr Name (optional)
        <input value={form.submitter_name} onChange={(e) => update('submitter_name', e.target.value)} />
      </label>
    </>
  );
}

export default function SubmitEvent() {
  const [mode, setMode] = useState('link');
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  // Link mode
  const [linkInput, setLinkInput] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkMatchInfo, setLinkMatchInfo] = useState(null);

  // Screenshot mode
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function resetAll() {
    setForm(initialForm);
    setLinkInput('');
    setLinkError('');
    setLinkMatchInfo(null);
    setOcrText('');
    setOcrError('');
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFetchLink() {
    if (!linkInput) return;
    setLinkLoading(true);
    setLinkError('');
    setLinkMatchInfo(null);
    try {
      const result = await api.extractFromLink(linkInput);
      setForm((f) => ({
        ...f,
        title: result.title || f.title,
        description: result.description || f.description,
        start_date: result.start_date || f.start_date,
        end_date: result.end_date || f.end_date,
        location: result.location || f.location,
        url: result.url || linkInput,
      }));
      if (result.matched === 'json-ld') {
        setLinkMatchInfo('Strukturierte Event-Daten gefunden — bitte trotzdem kurz prüfen.');
      } else if (result.matched === 'opengraph') {
        setLinkMatchInfo('Nur allgemeine Seiteninfos gefunden (kein Event-Format) — bitte Felder ergänzen/prüfen.');
      } else {
        setLinkMatchInfo('Keine automatisch erkennbaren Daten gefunden — bitte alle Felder manuell ausfüllen.');
      }
    } catch (err) {
      setLinkError(err.message);
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setOcrLoading(true);
    setOcrError('');
    setOcrText('');
    try {
      const result = await api.extractFromImage(file);
      setOcrText(result.text || '(kein Text erkannt)');
    } catch (err) {
      setOcrError(err.message);
    } finally {
      setOcrLoading(false);
    }
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
      resetAll();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  }

  return (
    <div className="submit-page">
      <h1>Event hinzufügen</h1>
      <p className="hint">
        Das Event wird nach kurzer Prüfung freigeschaltet und erscheint anschließend in der Übersicht.
      </p>

      <div className="mode-switch">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={mode === m.key ? 'mode-btn active' : 'mode-btn'}
            onClick={() => setMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="hint mode-hint">{MODES.find((m) => m.key === mode)?.hint}</p>

      {mode === 'link' && (
        <div className="mode-panel">
          <div className="link-input-row">
            <input
              type="url"
              placeholder="https://beispiel.de/mein-event"
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
      )}

      {mode === 'screenshot' && (
        <div className="mode-panel">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} />
          {ocrLoading && <p className="hint">Text wird erkannt…</p>}
          {ocrError && <p className="error">Fehler: {ocrError}</p>}
          {(imagePreview || ocrText) && (
            <div className="ocr-result">
              {imagePreview && <img src={imagePreview} alt="Vorschau" className="ocr-preview" />}
              {ocrText && (
                <div className="ocr-text-block">
                  <p className="hint">
                    Erkannter Text — bitte die passenden Werte unten manuell in die Felder übertragen:
                  </p>
                  <textarea readOnly rows={8} value={ocrText} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <form className="event-form" onSubmit={handleSubmit}>
        <EventFields form={form} update={update} categories={categories} />

        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Wird gesendet…' : 'Event einreichen'}
        </button>

        {status === 'success' && (
          <p className="success">Vielen Dank. Das Event wurde eingereicht und wartet auf Freigabe.</p>
        )}
        {status === 'error' && <p className="error">Fehler: {errorMsg}</p>}
      </form>
    </div>
  );
}
