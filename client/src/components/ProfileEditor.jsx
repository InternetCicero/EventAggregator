import { useState } from 'react';
import { HORIZONS, cycleCategory, isActive } from '../lib/matching/profile';

// Formular für das Interessenprofil von "Für dich". Arbeitet auf einem
// Entwurf; gespeichert wird erst über onSave (in den Browser-Speicher).

const CATEGORY_STATE = {
  in: { className: 'category-chip is-in', mark: '✓', label: 'interessiert mich' },
  out: { className: 'category-chip is-out', mark: '✕', label: 'interessiert mich nicht' },
  none: { className: 'category-chip', mark: '', label: 'neutral' },
};

function KeywordInput({ keywords, suggestions, onChange }) {
  const [text, setText] = useState('');

  function add() {
    const value = text.trim();
    if (!value) return;
    onChange([...keywords, value]);
    setText('');
  }

  return (
    <div className="filter-field">
      <span className="filter-label">Schlagwörter (z. B. case, m&a, private equity)</span>
      <div className="keyword-input">
        <input
          list="profile-keyword-suggestions"
          value={text}
          maxLength={40}
          placeholder="Schlagwort eingeben"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn-ghost" onClick={add} disabled={!text.trim() || keywords.length >= 15}>
          Hinzufügen
        </button>
      </div>
      <datalist id="profile-keyword-suggestions">
        {suggestions.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {keywords.length > 0 && (
        <div className="keyword-chips">
          {keywords.map((k) => (
            <button
              key={k}
              type="button"
              className="filter-chip"
              onClick={() => onChange(keywords.filter((x) => x !== k))}
            >
              {k}
              <span aria-label="Schlagwort entfernen"> ×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfileEditor({ draft, onChange, categories, tags, formats, onSave, onCancel, onDelete, saving }) {
  const set = (key, value) => onChange({ ...draft, [key]: value });
  const stateOf = (c) => (draft.categories.includes(c) ? 'in' : draft.excludedCategories.includes(c) ? 'out' : 'none');

  function toggleFormat(value) {
    set('formats', draft.formats.includes(value) ? draft.formats.filter((f) => f !== value) : [...draft.formats, value]);
  }

  return (
    <form
      className="profile-editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <fieldset className="profile-group">
        <legend>Was interessiert dich?</legend>
        <p className="hint">Antippen: einmal = interessiert mich, zweimal = interessiert mich nicht, dreimal = neutral.</p>
        <div className="category-chips">
          {categories.map((c) => {
            const state = CATEGORY_STATE[stateOf(c)];
            return (
              <button
                key={c}
                type="button"
                className={state.className}
                aria-label={`${c}: ${state.label}`}
                onClick={() => onChange(cycleCategory(draft, c))}
              >
                {state.mark && <span aria-hidden="true">{state.mark} </span>}
                {c}
              </button>
            );
          })}
        </div>
        <KeywordInput keywords={draft.keywords} suggestions={tags} onChange={(k) => set('keywords', k)} />
      </fieldset>

      <fieldset className="profile-group">
        <legend>Wo und wann?</legend>
        <div className="form-row">
          <label className="filter-field">
            <span className="filter-label">Hauptstadt</span>
            <input
              value={draft.cities.primary}
              maxLength={60}
              placeholder="z. B. München"
              onChange={(e) => set('cities', { ...draft.cities, primary: e.target.value })}
            />
          </label>
          <label className="filter-field">
            <span className="filter-label">Zweitstadt (optional)</span>
            <input
              value={draft.cities.secondary}
              maxLength={60}
              placeholder="z. B. Frankfurt"
              onChange={(e) => set('cities', { ...draft.cities, secondary: e.target.value })}
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={draft.acceptOnline} onChange={(e) => set('acceptOnline', e.target.checked)} />
          Online-Events sind für mich okay
        </label>
        <div className="filter-field">
          <span className="filter-label">Bevorzugtes Format (leer = egal)</span>
          <div className="inline-fieldset">
            {formats.map((f) => (
              <label key={f.value} className="checkbox-label">
                <input type="checkbox" checked={draft.formats.includes(f.value)} onChange={() => toggleFormat(f.value)} />
                {f.label}
              </label>
            ))}
          </div>
        </div>
        <div className="filter-field">
          <span className="filter-label">Wie weit im Voraus?</span>
          <div className="segmented" role="group" aria-label="Zeitraum">
            {HORIZONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={draft.horizonDays === d}
                className={draft.horizonDays === d ? 'seg is-active' : 'seg'}
                onClick={() => set('horizonDays', d)}
              >
                {d} Tage
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="profile-actions">
        <button type="submit" disabled={!isActive(draft) || saving}>
          Profil speichern
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Abbrechen
          </button>
        )}
        {onDelete && (
          <button type="button" className="btn-danger profile-delete" onClick={onDelete}>
            Profil löschen
          </button>
        )}
      </div>
      {!isActive(draft) && (
        <p className="hint">Wähle mindestens eine Kategorie, ein Schlagwort oder eine Hauptstadt.</p>
      )}
    </form>
  );
}
