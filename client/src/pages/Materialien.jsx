import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { FORMATS, FORMAT_LABEL, MATERIALS as data } from '../lib/materials';

function MaterialCard({ m, from }) {
  return (
    <Link to={`/materialien/${m.id}`} state={{ from }} className="event-card material-card">
      <div className="event-card-badges">
        <div className="event-card-category">{m.category}</div>
        <div className="event-card-format">{FORMAT_LABEL[m.type] || m.type}</div>
      </div>
      <h3 className="event-card-title">{m.title}</h3>
      <p>{m.description}</p>
      <span className="material-more">Ansehen →</span>
    </Link>
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
  // Filter stehen in der Adresse (?thema=…&format=…), damit "Zurück" sie wiederherstellt.
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const category = data.categories.includes(params.get('thema')) ? params.get('thema') : '';
  const format = FORMAT_LABEL[params.get('format')] ? params.get('format') : '';

  function setFilter(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next);
  }

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
            onChange={(v) => setFilter('thema', v)}
          />
          <FilterRow label="Format" options={presentFormats} value={format} onChange={(v) => setFilter('format', v)} />
        </>
      )}

      {data.items.length === 0 ? (
        <p>Noch keine Materialien vorhanden.</p>
      ) : items.length === 0 ? (
        <p>Keine Materialien für diese Auswahl.</p>
      ) : (
        <div className="event-grid">
          {items.map((m) => (
            <MaterialCard key={m.id} m={m} from={location.search} />
          ))}
        </div>
      )}
    </section>
  );
}
