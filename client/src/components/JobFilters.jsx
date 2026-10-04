import { useState } from 'react';
import { DEGREE_LABELS, WORK_MODE_LABELS } from '../lib/jobLabels';
import { emptyJobFilters } from '../lib/jobForm';

// Filterleiste für /jobs: die häufigsten Filter immer sichtbar, der Rest
// thematisch gruppiert in einem aufklappbaren Bereich. Aktive Filter
// erscheinen als Chips und lassen sich einzeln entfernen.

// Filter im aufklappbaren Bereich (für den Zähler am Button)
const ADVANCED_KEYS = ['degree_level', 'semester', 'work_mode', 'paid', 'salary_given', 'sector', 'language'];

const PAID_OPTIONS = { yes: 'Bezahlt', no: 'Unbezahlt' };

function Segmented({ label, value, options, onChange }) {
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

function chipLabels(filters, meta) {
  const chips = [];
  const add = (key, text) => chips.push({ key, text });
  if (filters.search) add('search', `„${filters.search}“`);
  if (filters.job_type) add('job_type', meta?.jobTypes.find((t) => t.value === filters.job_type)?.label);
  if (filters.location) add('location', `Ort: ${filters.location}`);
  if (filters.degree_level) add('degree_level', DEGREE_LABELS[filters.degree_level]);
  if (filters.semester) add('semester', `${filters.semester}. Semester`);
  if (filters.work_mode) add('work_mode', WORK_MODE_LABELS[filters.work_mode]);
  if (filters.paid) add('paid', PAID_OPTIONS[filters.paid]);
  if (filters.salary_given) add('salary_given', 'Gehalt angegeben');
  if (filters.sector) add('sector', filters.sector);
  if (filters.language) add('language', meta?.languages.find((l) => l.value === filters.language)?.label);
  return chips;
}

export default function JobFilters({ filters, onChange, meta, resultCount }) {
  const [open, setOpen] = useState(false);
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const advancedCount = ADVANCED_KEYS.filter((k) => filters[k]).length;
  const chips = chipLabels(filters, meta);

  return (
    <div className="job-filters">
      <div className="job-filters-main">
        <input
          type="search"
          className="filter-search"
          placeholder="Suche nach Titel, Firma, Beschreibung…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
        <select value={filters.job_type} onChange={(e) => set('job_type', e.target.value)} aria-label="Stellenart">
          <option value="">Alle Stellenarten</option>
          {meta?.jobTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Ort"
          aria-label="Ort"
          value={filters.location}
          onChange={(e) => set('location', e.target.value)}
        />
        <button
          type="button"
          className={open ? 'btn-ghost filter-toggle is-open' : 'btn-ghost filter-toggle'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          Weitere Filter
          {advancedCount > 0 && <span className="filter-count">{advancedCount}</span>}
          <span className="filter-caret" aria-hidden="true">
            ▾
          </span>
        </button>
      </div>

      {open && (
        <div className="job-filters-panel">
          <fieldset className="filter-group">
            <legend>Studium</legend>
            <Segmented
              label="Abschluss"
              value={filters.degree_level}
              options={{ bachelor: DEGREE_LABELS.bachelor, master: DEGREE_LABELS.master }}
              onChange={(v) => set('degree_level', v)}
            />
            <label className="filter-field">
              <span className="filter-label">Mein Fachsemester</span>
              <input
                type="number"
                min="1"
                max="20"
                placeholder="z. B. 4"
                value={filters.semester}
                onChange={(e) => set('semester', e.target.value)}
              />
            </label>
          </fieldset>

          <fieldset className="filter-group">
            <legend>Rahmen</legend>
            <Segmented
              label="Arbeitsmodell"
              value={filters.work_mode}
              options={WORK_MODE_LABELS}
              onChange={(v) => set('work_mode', v)}
            />
            <Segmented label="Bezahlung" value={filters.paid} options={PAID_OPTIONS} onChange={(v) => set('paid', v)} />
            <label className="checkbox-label filter-check">
              <input
                type="checkbox"
                checked={filters.salary_given === '1'}
                onChange={(e) => set('salary_given', e.target.checked ? '1' : '')}
              />
              Nur mit Gehaltsangabe
            </label>
          </fieldset>

          <fieldset className="filter-group">
            <legend>Firma & Sprache</legend>
            <label className="filter-field">
              <span className="filter-label">Branche</span>
              <select value={filters.sector} onChange={(e) => set('sector', e.target.value)}>
                <option value="">Alle Branchen</option>
                {meta?.sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span className="filter-label">Arbeitssprache</span>
              <select value={filters.language} onChange={(e) => set('language', e.target.value)}>
                <option value="">Alle Sprachen</option>
                {meta?.languages.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        </div>
      )}

      <div className="job-filters-summary">
        <span className="result-count">
          {resultCount === null ? 'Lädt…' : `${resultCount} ${resultCount === 1 ? 'Stelle' : 'Stellen'}`}
        </span>
        {chips.map((c) => (
          <button key={c.key} type="button" className="filter-chip" onClick={() => set(c.key, '')}>
            {c.text}
            <span aria-label="Filter entfernen"> ×</span>
          </button>
        ))}
        {chips.length > 1 && (
          <button type="button" className="filter-reset" onClick={() => onChange(emptyJobFilters)}>
            Alle zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}
