// Vibe-Regler: fünf Stufen zwischen zwei Polen. Als Knopfreihe statt
// <input type="range">, weil ein Regler auch "keine Angabe" sein kann
// (optional, keine vorausgewählte Mitte, Spec AC-3). Ein zweiter Klick auf
// die gewählte Stufe hebt die Auswahl wieder auf.

export function VibeInput({ dimensions, value, onChange }) {
  return (
    <div className="vibe-list">
      {dimensions.map((d) => (
        <fieldset key={d.key} className="vibe-row">
          <legend className="visually-hidden">
            {d.left} bis {d.right}
          </legend>
          <span className="vibe-pole">{d.left}</span>
          <div className="vibe-steps" role="radiogroup">
            {[1, 2, 3, 4, 5].map((step) => (
              <button
                key={step}
                type="button"
                role="radio"
                aria-checked={value[d.key] === step}
                aria-label={`Stufe ${step} von 5`}
                className={value[d.key] === step ? 'vibe-step is-active' : 'vibe-step'}
                onClick={() => {
                  const next = { ...value };
                  if (next[d.key] === step) delete next[d.key];
                  else next[d.key] = step;
                  onChange(next);
                }}
              />
            ))}
          </div>
          <span className="vibe-pole is-right">{d.right}</span>
        </fieldset>
      ))}
    </div>
  );
}

export function VibeDisplay({ dimensions, value }) {
  return (
    <div className="vibe-list">
      {dimensions.map((d) => {
        const v = value?.[d.key];
        if (!v) return null;
        return (
          <div key={d.key} className="vibe-row" aria-label={`${d.left} – ${d.right}: ${v} von 5`}>
            <span className="vibe-pole">{d.left}</span>
            <div className="vibe-track">
              <span className="vibe-dot" style={{ left: `${((v - 1) / 4) * 100}%` }} />
            </div>
            <span className="vibe-pole is-right">{d.right}</span>
          </div>
        );
      })}
    </div>
  );
}
