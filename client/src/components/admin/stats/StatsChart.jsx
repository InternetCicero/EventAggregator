import { formatCompact, formatInt, fullLabel, isWeekend, labelEvery, niceMax, shortLabel, weekdayLabel } from '../../../lib/statsMath';

const MAX_VALUE_LABELS = 14;

export default function StatsChart({ perDay, byMonth }) {
  const count = perDay.length;
  const max = niceMax(Math.max(1, ...perDay.map((d) => d.views)));
  const showValues = count <= MAX_VALUE_LABELS;
  const every = showValues ? 1 : labelEvery(count, 6);
  const hasPartial = perDay.some((d) => d.partial);
  const pct = (v) => `${Math.round((v / max) * 1000) / 10}%`;
  const ticks = [max, max / 2, 0];

  return (
    <figure className="stats-chart">
      <div className="stats-legend">
        <span>
          <i className="stats-swatch is-visitors" /> Besucher
        </span>
        <span>
          <i className="stats-swatch is-views" /> Aufrufe
        </span>
        {hasPartial && (
          <span>
            <i className="stats-swatch is-partial" /> läuft noch
          </span>
        )}
      </div>
      <div className="stats-chart-body">
        <div className="stats-axis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t}>{formatCompact(t)}</span>
          ))}
        </div>
        <div
          className="stats-plot"
          role="img"
          aria-label={`Besucher und Aufrufe ${byMonth ? 'pro Monat' : 'pro Tag'}, Werte in der Tabelle darunter`}
        >
          <div className="stats-grid" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          {perDay.map((d, i) => (
            <div
              key={d.day}
              className={['stats-col', !byMonth && isWeekend(d.day) ? 'is-weekend' : '', d.partial ? 'is-partial' : '']
                .filter(Boolean)
                .join(' ')}
              title={`${fullLabel(d.day)}: ${formatInt(d.visitors)} Besucher, ${formatInt(d.views)} Aufrufe${d.partial ? ' (läuft noch)' : ''}`}
            >
              <div className="stats-col-bars">
                {showValues && (
                  <span className="stats-col-value" style={{ bottom: pct(d.views) }}>
                    {formatCompact(d.visitors)}
                  </span>
                )}
                <span className="stats-bar is-views" style={{ height: pct(d.views) }} />
                <span className="stats-bar is-visitors" style={{ height: pct(d.visitors) }} />
              </div>
              <span className="stats-col-label">
                {i % every === 0 ? (
                  <>
                    {showValues && !byMonth && <b>{weekdayLabel(d.day)}</b>}
                    {shortLabel(d.day)}
                  </>
                ) : (
                  ''
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}
