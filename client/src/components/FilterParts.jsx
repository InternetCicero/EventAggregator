// Gemeinsame Bausteine der Filterleisten (Events und Jobs): Umschalter für
// wenige Optionen, Button für den aufklappbaren Bereich und die Zeile mit
// Trefferzahl und entfernbaren Filter-Chips.

export function Segmented({ label, value, options, onChange }) {
  return (
    <div className="filter-field">
      <span className="filter-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        <button type="button" className={value ? 'seg' : 'seg is-active'} onClick={() => onChange('')}>
          Alle
        </button>
        {Object.entries(options).map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            className={value === v ? 'seg is-active' : 'seg'}
            onClick={() => onChange(value === v ? '' : v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterToggle({ open, onToggle, activeCount }) {
  return (
    <button
      type="button"
      className={open ? 'btn-ghost filter-toggle is-open' : 'btn-ghost filter-toggle'}
      aria-expanded={open}
      onClick={onToggle}
    >
      Weitere Filter
      {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
      <span className="filter-caret" aria-hidden="true">
        ▾
      </span>
    </button>
  );
}

// chips: [{ key, text }]; onRemove(key) entfernt einen Filter
export function FilterSummary({ resultText, chips, onRemove, onReset }) {
  return (
    <div className="filter-bar-summary">
      <span className="result-count">{resultText}</span>
      {chips.map((c) => (
        <button key={c.key} type="button" className="filter-chip" onClick={() => onRemove(c.key)}>
          {c.text}
          <span aria-label="Filter entfernen"> ×</span>
        </button>
      ))}
      {chips.length > 1 && (
        <button type="button" className="filter-reset" onClick={onReset}>
          Alle zurücksetzen
        </button>
      )}
    </div>
  );
}
