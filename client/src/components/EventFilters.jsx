import { useState } from 'react';
import { FilterSummary, FilterToggle, Segmented } from './FilterParts';
import { emptyEventFilters, matchingRange, rangeDates, RANGE_LABELS } from '../lib/eventFilters';

// Filterleiste für die Event-Übersicht, gleicher Aufbau wie bei den Jobs:
// Suche und Kategorie immer sichtbar, Zeitraum/Format/Tags aufklappbar.

const ADVANCED_KEYS = ['from', 'to', 'format', 'tag'];

function formatDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function chipLabels(filters, formats) {
  const chips = [];
  const add = (key, text) => chips.push({ key, text });
  if (filters.search) add('search', `„${filters.search}“`);
  if (filters.category) add('category', filters.category);
  const range = matchingRange(filters.from, filters.to);
  if (range) add('range', RANGE_LABELS[range]);
  else {
    if (filters.from) add('from', `ab ${formatDay(filters.from)}`);
    if (filters.to) add('to', `bis ${formatDay(filters.to)}`);
  }
  if (filters.format) add('format', formats.find((f) => f.value === filters.format)?.label || filters.format);
  if (filters.tag) add('tag', `#${filters.tag}`);
  return chips;
}

export default function EventFilters({ filters, onChange, categories, formats, tags, resultCount }) {
  const [open, setOpen] = useState(false);
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const advancedCount =
    ADVANCED_KEYS.filter((k) => filters[k]).length - (filters.from && filters.to && matchingRange(filters.from, filters.to) ? 1 : 0);
  const chips = chipLabels(filters, formats);
  const formatOptions = Object.fromEntries(formats.map((f) => [f.value, f.label]));

  function remove(key) {
    if (key === 'range') onChange({ ...filters, from: '', to: '' });
    else set(key, '');
  }

  function setRange(range) {
    onChange({ ...filters, ...(range ? rangeDates(range) : { from: '', to: '' }) });
  }

  return (
    <div className="filter-bar">
      <div className="filter-bar-main is-compact">
        <input
          type="search"
          className="filter-search"
          placeholder="Suche nach Titel, Ort, Beschreibung…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
        <select value={filters.category} onChange={(e) => set('category', e.target.value)} aria-label="Kategorie">
          <option value="">Alle Kategorien</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <FilterToggle open={open} onToggle={() => setOpen((o) => !o)} activeCount={advancedCount} />
      </div>

      {open && (
        <div className="filter-bar-panel is-two-col">
          <fieldset className="filter-group">
            <legend>Zeitraum</legend>
            <Segmented
              label="Schnellauswahl"
              value={matchingRange(filters.from, filters.to) || (filters.from || filters.to ? 'custom' : '')}
              options={RANGE_LABELS}
              onChange={setRange}
            />
            <div className="filter-date-row">
              <label className="filter-field">
                <span className="filter-label">Von</span>
                <input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
              </label>
              <label className="filter-field">
                <span className="filter-label">Bis</span>
                <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set('to', e.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset className="filter-group">
            <legend>Format & Tags</legend>
            <Segmented label="Wo findet es statt?" value={filters.format} options={formatOptions} onChange={(v) => set('format', v)} />
            <label className="filter-field">
              <span className="filter-label">Schlagwort</span>
              <select value={filters.tag} onChange={(e) => set('tag', e.target.value)}>
                <option value="">Alle Tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        </div>
      )}

      <FilterSummary
        resultText={resultCount === null ? 'Lädt…' : `${resultCount} ${resultCount === 1 ? 'Event' : 'Events'}`}
        chips={chips}
        onRemove={remove}
        onReset={() => onChange(emptyEventFilters)}
      />
    </div>
  );
}
