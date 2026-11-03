import { useEffect, useRef, useState } from 'react';
import data from '../data/materials.json';

const BASE = '/materialien/';
const fileUrl = (file) => BASE + encodeURIComponent(file);

// Reihenfolge der Format-Filter und Badge-Namen.
const FORMATS = [
  ['prompt', 'Prompt'],
  ['text', 'Text'],
  ['datei', 'Datei'],
  ['bild', 'Bild'],
  ['link', 'Link'],
];
const FORMAT_LABEL = Object.fromEntries(FORMATS);

// Lädt eine Textdatei beim ersten Aufruf von load(). nginx liefert bei
// unbekannten Pfaden die Startseite (HTML) mit 200 zurück, das zählt als Fehler.
function useTextFile(file) {
  const [state, setState] = useState({ status: 'idle', text: '' });

  async function load() {
    if (state.status !== 'idle') return;
    setState({ status: 'loading', text: '' });
    try {
      const res = await fetch(fileUrl(file));
      const type = res.headers.get('content-type') || '';
      if (!res.ok || type.includes('text/html')) throw new Error('not found');
      setState({ status: 'ready', text: await res.text() });
    } catch {
      setState({ status: 'error', text: '' });
    }
  }
  return [state, load];
}

function LoadState({ status }) {
  if (status === 'loading') return <p className="hint">Lädt…</p>;
  if (status === 'error') return <p className="error">Material konnte nicht geladen werden.</p>;
  return null;
}

function PromptText({ file }) {
  const [state, load] = useTextFile(file);
  const [copied, setCopied] = useState(null);
  const preRef = useRef(null);

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
      <LoadState status={state.status} />
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

// Markdown wird erst beim ersten Aufklappen nachgeladen (eigener Chunk).
function ReadableText({ file }) {
  const [state, load] = useTextFile(file);
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (state.status !== 'ready') return;
    let cancelled = false;
    import('../lib/markdown').then(({ renderMarkdown }) => {
      if (!cancelled) setHtml(renderMarkdown(state.text));
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  return (
    <details className="material-prompt" onToggle={(e) => e.currentTarget.open && load()}>
      <summary>Lesen</summary>
      <LoadState status={state.status} />
      {state.status === 'ready' && <div className="material-text" dangerouslySetInnerHTML={{ __html: html }} />}
    </details>
  );
}

function ImagePreview({ material }) {
  const dialogRef = useRef(null);
  const src = fileUrl(material.file);

  return (
    <>
      <button
        type="button"
        className="material-image-btn"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`${material.title} vergrößern`}
      >
        <img src={src} alt={material.alt} loading="lazy" className="material-image" />
      </button>
      <dialog
        ref={dialogRef}
        className="material-dialog"
        onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
      >
        <img src={src} alt={material.alt} />
        <button type="button" className="btn-ghost" onClick={() => dialogRef.current?.close()}>
          Schließen
        </button>
      </dialog>
    </>
  );
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function MaterialCard({ m }) {
  return (
    <article className="event-card material-card">
      <div className="event-card-badges">
        <div className="event-card-category">{m.category}</div>
        <div className="event-card-format">{FORMAT_LABEL[m.type] || m.type}</div>
      </div>
      <h3 className="event-card-title">{m.title}</h3>
      <p>{m.description}</p>
      {m.type === 'prompt' && <PromptText file={m.file} />}
      {m.type === 'text' && <ReadableText file={m.file} />}
      {m.type === 'bild' && <ImagePreview material={m} />}
      {m.type === 'link' ? (
        <a className="material-download" href={m.url} target="_blank" rel="noopener noreferrer">
          Öffnen ({hostOf(m.url)})
        </a>
      ) : (
        <a className="material-download" href={fileUrl(m.file)} download={m.file}>
          Herunterladen
        </a>
      )}
    </article>
  );
}

function FilterRow({ label, options, value, onChange }) {
  return (
    <div className="material-filter" role="group" aria-label={label}>
      <span className="material-filter-label">{label}</span>
      {[['', 'Alle'], ...options].map(([key, text]) => (
        <button
          key={key || 'alle'}
          type="button"
          className={`btn-ghost${value === key ? ' is-active' : ''}`}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export default function Materialien() {
  const [category, setCategory] = useState('');
  const [format, setFormat] = useState('');

  const presentFormats = FORMATS.filter(([key]) => data.items.some((m) => m.type === key));
  const items = data.items.filter(
    (m) => (!category || m.category === category) && (!format || m.type === format),
  );

  return (
    <section>
      <h1>Materialien</h1>
      <p className="hint">
        Prompts und Vorlagen für Bewerbung und Karrierestart, kostenlos und ohne Anmeldung. Die Materialien sind
        Hilfestellungen ohne Erfolgsgarantie. Bitte tragen Sie in KI-Tools keine echten persönlichen Daten ein, die Prompts
        arbeiten mit Platzhaltern.
      </p>

      {data.items.length > 0 && (
        <>
          <FilterRow
            label="Thema"
            options={data.categories.map((c) => [c, c])}
            value={category}
            onChange={setCategory}
          />
          <FilterRow label="Format" options={presentFormats} value={format} onChange={setFormat} />
        </>
      )}

      {data.items.length === 0 ? (
        <p>Noch keine Materialien vorhanden.</p>
      ) : items.length === 0 ? (
        <p>Keine Materialien für diese Auswahl.</p>
      ) : (
        <div className="event-grid">
          {items.map((m) => (
            <MaterialCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </section>
  );
}
