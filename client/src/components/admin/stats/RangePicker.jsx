import { useState } from 'react';

const PRESETS = [
  { key: '7', label: '7 Tage', range: { kind: 'days', days: 7 } },
  { key: '30', label: '30 Tage', range: { kind: 'days', days: 30 } },
  { key: '90', label: '90 Tage', range: { kind: 'days', days: 90 } },
  { key: '12m', label: '12 Monate', range: { kind: '12m' } },
];

function activeKey(range) {
  if (range.kind === 'days') return String(range.days);
  return range.kind;
}

export default function RangePicker({ range, onChange, today }) {
  const [open, setOpen] = useState(range.kind === 'custom');
  const [from, setFrom] = useState(range.kind === 'custom' ? range.from : '');
  const [to, setTo] = useState(range.kind === 'custom' ? range.to : '');
  const valid = from && to && from <= to;
  const current = activeKey(range);

  return (
    <div className="stats-range">
      <div className="mode-switch">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={current === p.key ? 'mode-btn active' : 'mode-btn'}
            onClick={() => {
              setOpen(false);
              onChange(p.range);
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={current === 'custom' || open ? 'mode-btn active' : 'mode-btn'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          Zeitraum …
        </button>
      </div>
      {open && (
        <form
          className="stats-range-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onChange({ kind: 'custom', from, to });
          }}
        >
          <label>
            Von
            <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} required />
          </label>
          <label>
            Bis
            <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} required />
          </label>
          <button type="submit" disabled={!valid}>
            Anwenden
          </button>
          {from && to && from > to && <span className="error">„Von“ muss vor „Bis“ liegen.</span>}
        </form>
      )}
    </div>
  );
}
