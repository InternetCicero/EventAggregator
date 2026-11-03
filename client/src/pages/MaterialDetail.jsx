import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { FORMAT_LABEL, fileUrl, findMaterial, hostOf } from '../lib/materials';

// Lädt eine Textdatei beim Anzeigen der Seite. nginx liefert bei unbekannten
// Pfaden die Startseite (HTML) mit 200 zurück, das zählt als Fehler.
function useTextFile(file) {
  const [state, setState] = useState({ file, status: 'loading', text: '' });

  useEffect(() => {
    let cancelled = false;
    fetch(fileUrl(file))
      .then(async (res) => {
        const type = res.headers.get('content-type') || '';
        if (!res.ok || type.includes('text/html')) throw new Error('not found');
        return res.text();
      })
      .then((text) => !cancelled && setState({ file, status: 'ready', text }))
      .catch(() => !cancelled && setState({ file, status: 'error', text: '' }));
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Beim Wechsel auf ein anderes Material gilt der alte Stand nicht mehr.
  return state.file === file ? state : { file, status: 'loading', text: '' };
}

function LoadState({ status }) {
  if (status === 'loading') return <p className="hint">Lädt…</p>;
  if (status === 'error') return <p className="error">Material konnte nicht geladen werden.</p>;
  return null;
}

function DownloadButton({ file, label = 'Herunterladen' }) {
  return (
    <a className="btn material-btn" href={fileUrl(file)} download={file}>
      {label}
    </a>
  );
}

function PromptAsset({ material }) {
  const state = useTextFile(material.file);
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
    <>
      <LoadState status={state.status} />
      {state.status === 'ready' && (
        <>
          <pre ref={preRef} className="material-prompt-text">
            {state.text}
          </pre>
          <div className="material-actions">
            <button type="button" onClick={copy}>
              Kopieren
            </button>
            <DownloadButton file={material.file} label="Als .md herunterladen" />
            <span className="material-copy-hint" role="status">
              {copied === 'ok' && 'Kopiert'}
              {copied === 'manual' && 'Text markiert, bitte mit Strg/Cmd+C kopieren'}
            </span>
          </div>
        </>
      )}
    </>
  );
}

// Markdown wird erst bei Bedarf nachgeladen (eigener Chunk).
function TextAsset({ material }) {
  const state = useTextFile(material.file);
  const [rendered, setRendered] = useState({ text: null, html: '' });

  useEffect(() => {
    if (state.status !== 'ready') return;
    let cancelled = false;
    import('../lib/markdown').then(({ renderMarkdown }) => {
      if (!cancelled) setRendered({ text: state.text, html: renderMarkdown(state.text) });
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  return (
    <>
      <LoadState status={state.status} />
      {state.status === 'ready' && rendered.text === state.text && (
        <>
          <div className="material-text" dangerouslySetInnerHTML={{ __html: rendered.html }} />
          <div className="material-actions">
            <DownloadButton file={material.file} label="Als .md herunterladen" />
          </div>
        </>
      )}
    </>
  );
}

function FileAsset({ material }) {
  const ext = material.file.split('.').pop().toUpperCase();
  return (
    <div className="material-file">
      <span className="event-card-format">{ext}</span>
      <span className="material-file-name">{material.file}</span>
      <DownloadButton file={material.file} />
    </div>
  );
}

function ImageAsset({ material }) {
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
        <img src={src} alt={material.alt} className="material-image material-image--large" />
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
      <div className="material-actions">
        <DownloadButton file={material.file} />
      </div>
    </>
  );
}

function LinkAsset({ material }) {
  return (
    <div className="material-actions">
      <a className="btn material-btn" href={material.url} target="_blank" rel="noopener noreferrer">
        Öffnen ({hostOf(material.url)})
      </a>
    </div>
  );
}

const ASSETS = { prompt: PromptAsset, text: TextAsset, datei: FileAsset, bild: ImageAsset, link: LinkAsset };

function InfoList({ title, items, ordered }) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <section className="material-info-block">
      <h2>{title}</h2>
      <List>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </List>
    </section>
  );
}

export default function MaterialDetail() {
  const { id } = useParams();
  const location = useLocation();
  const material = findMaterial(id);
  const backTo = `/materialien${location.state?.from || ''}`;

  useEffect(() => {
    const previous = document.title;
    if (material) document.title = `${material.title} – Student Hub`;
    return () => {
      document.title = previous;
    };
  }, [material]);

  if (!material) {
    return (
      <section>
        <h1>Material nicht gefunden</h1>
        <p>
          Dieses Material gibt es nicht (mehr). <Link to="/materialien">Zur Übersicht der Materialien</Link>
        </p>
      </section>
    );
  }

  const Asset = ASSETS[material.type];
  return (
    <article className="material-detail">
      <Link to={backTo} className="material-back">
        ← Alle Materialien
      </Link>
      <div className="event-card-badges">
        <div className="event-card-category">{material.category}</div>
        <div className="event-card-format">{FORMAT_LABEL[material.type]}</div>
      </div>
      <h1>{material.title}</h1>
      <p className="material-lead">{material.description}</p>

      <div className="material-info">
        <InfoList title="Was es bringt" items={material.outcome} />
        <InfoList title="Wann nutzen" items={material.useWhen} />
      </div>
      {material.steps && <InfoList title="So geht’s" items={material.steps} ordered />}

      <section className="material-asset">
        <h2>Das Material</h2>
        <Asset material={material} />
      </section>
    </article>
  );
}
