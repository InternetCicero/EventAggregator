import { formatDecimal, formatDuration, formatInt, fullLabel } from '../../../lib/statsMath';

export default function StatsDayTable({ perDay, byMonth }) {
  const rows = [...perDay].reverse();
  return (
    <details className="stats-details">
      <summary>{byMonth ? 'Pro Monat als Tabelle anzeigen' : 'Pro Tag als Tabelle anzeigen'}</summary>
      <div className="stats-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{byMonth ? 'Monat' : 'Datum'}</th>
              <th>Besucher</th>
              <th>Aufrufe</th>
              <th>Aufrufe je Besucher</th>
              <th>Ø Dauer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.day}>
                <td>
                  {fullLabel(d.day)}
                  {d.partial ? ' (läuft noch)' : ''}
                </td>
                <td>{formatInt(d.visitors)}</td>
                <td>{formatInt(d.views)}</td>
                <td>{d.visitors ? formatDecimal(Math.round((d.views / d.visitors) * 10) / 10) : '–'}</td>
                <td>{formatDuration(d.avgSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
