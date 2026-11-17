import { WEEKDAY_NAMES, formatDecimal, formatInt, groupShares } from '../../../lib/statsMath';

const GROUP_LABELS = {
  events: 'Events',
  jobs: 'Stellen',
  materialien: 'Materialien',
  einreichen: 'Einreichen',
  rechtliches: 'Rechtliches',
};

export default function StatsBreakdown({ groups, weekday }) {
  const shares = groupShares(groups);
  const total = groups.reduce((a, g) => a + g.views, 0);
  const maxWeekday = Math.max(0.1, ...weekday.map((w) => w.avgVisitors));

  return (
    <div className="stats-breakdown">
      <section>
        <h3>Wo schauen sie hin?</h3>
        {total === 0 ? (
          <p className="hint">Noch keine Daten.</p>
        ) : (
          <ul className="stats-groups">
            {shares.map((g) => (
              <li key={g.key}>
                <span className="stats-group-name">{GROUP_LABELS[g.key]}</span>
                <span className="stats-group-track" aria-hidden="true">
                  <i style={{ width: `${g.percent}%` }} />
                </span>
                <span className="stats-group-value">
                  {g.percent} % · {formatInt(g.views)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3>Wochentage</h3>
        <ul className="stats-weekdays">
          {weekday.map((w) => (
            <li key={w.weekday}>
              <span className="stats-weekday-value">{w.days ? formatDecimal(w.avgVisitors) : '–'}</span>
              <span className="stats-weekday-bar" aria-hidden="true">
                <i style={{ height: `${Math.round((w.avgVisitors / maxWeekday) * 100)}%` }} />
              </span>
              <span className="stats-weekday-name">{WEEKDAY_NAMES[w.weekday - 1]}</span>
            </li>
          ))}
        </ul>
        <p className="hint">Ø Besucher je Wochentag, nur abgeschlossene Tage.</p>
      </section>
    </div>
  );
}
