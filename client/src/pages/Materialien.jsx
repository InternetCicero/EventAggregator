import { useRef, useState } from 'react';
import data from '../data/materials.json';

const BASE = '/materialien/';

function PromptText({ file }) {
  const [state, setState] = useState({ status: 'idle', text: '' });
  const [copied, setCopied] = useState(null);
  const preRef = useRef(null);

  // Laden beim ersten Aufklappen; nginx liefert bei unbekannten Pfaden die
  // Startseite (HTML) mit 200 zurück, das zählt hier als Fehler.
  async function load() {
    if (state.status !== 'idle') return;
    setState({ status: 'loading', text: '' });
    try {
      const res = await fetch(BASE + encodeURIComponent(file));
      const type = res.headers.get('content-type') || '';
      if (!res.ok || type.includes('text/html')) throw new Error('not found');
      setState({ status: 'ready', text: await res.text() });
    } catch {
      setState({ status: 'error', text: '' });
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(state.text);
      setCopied('ok');
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(preRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
      setCopied('manual');
    }
    setTimeout(() => setCopied(null), 3000);
  }

  return (
    <details className="material-prompt" onToggle={(e) => e.currentTarget.open && load()}>
      <summary>Prompt anzeigen</summary>
      {state.status === 'loading' && <p className="hint">Lädt…</p>}
      {state.status === 'error' && <p className="error">Material konnte nicht geladen werden.</p>}
      {state.status === 'ready' && (
        <>
          <pre ref={preRef} className="material-prompt-text">
            {state.text}
          </pre>
          <button type="button" onClick={copy}>
            Kopieren
          </button>
          <span className="material-copy-hint" role="status">
            {copied === 'ok' && 'Kopiert'}
            {copied === 'manual' && 'Text markiert, bitte mit Strg/Cmd+C kopieren'}
          </span>
        </>
      )}
    </details>
  );
}

export default function Materialien() {
  const [category, setCategory] = useState('');
  const items = data.items.filter((m) => !category || m.category === category);

  return (
    <section>
      <h1>Materialien</h1>
      <p className="hint">
        Prompts und Vorlagen für Bewerbung und Karrierestart, kostenlos und ohne Anmeldung. Die Materialien sind
        Hilfestellungen ohne Erfolgsgarantie. Bitte tragen Sie in KI-Tools keine echten persönlichen Daten ein, die Prompts
        arbeiten mit Platzhaltern.
      </p>

      {data.items.length > 0 && (
        <div className="material-filter" role="group" aria-label="Kategorie">
          {['', ...data.categories].map((c) => (
            <button
              key={c || 'alle'}
              type="button"
              className={`btn-ghost${category === c ? ' is-active' : ''}`}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c || 'Alle'}
            </button>
          ))}
        </div>
      )}

      {data.items.length === 0 ? (
        <p>Noch keine Materialien vorhanden.</p>
      ) : (
        <div className="event-grid">
          {items.map((m) => (
            <article key={m.id} className="event-card material-card">
              <div className="event-card-badges">
                <div className="event-card-category">{m.category}</div>
                <div className="event-card-format">{m.type === 'prompt' ? 'Prompt' : 'Datei'}</div>
              </div>
              <h3 className="event-card-title">{m.title}</h3>
              <p>{m.description}</p>
              {m.type === 'prompt' && <PromptText file={m.file} />}
              <a className="material-download" href={BASE + encodeURIComponent(m.file)} download={m.file}>
                Herunterladen
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
