import { useEffect, useState } from 'react';
import { api } from '../../api';
import { formatDuration, formatInt, rangeQuery } from '../../lib/statsMath';
import RangePicker from './stats/RangePicker';
import StatsBreakdown from './stats/StatsBreakdown';
import StatsCards from './stats/StatsCards';
import StatsChart from './stats/StatsChart';
import StatsDayTable from './stats/StatsDayTable';

export default function StatsAdmin() {
  const [range, setRange] = useState({ kind: 'days', days: 7 });
  const [result, setResult] = useState({ key: null, data: null, error: '' });
  const [exportError, setExportError] = useState('');
  const query = rangeQuery(range);

  useEffect(() => {
    let cancelled = false;
    api.admin
      .getStats(query)
      .then((data) => !cancelled && setResult({ key: query, data, error: '' }))
      .catch((err) => !cancelled && setResult({ key: query, data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const loading = result.key !== query;
  const { data, error } = result;
  const byMonth = data?.granularity === 'month';
  const noData = data && data.totals.views === 0;

  async function exportCsv() {
    setExportError('');
    try {
      const blob = await api.admin.getStatsCsv(query);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statistik-${data.from}_${data.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message);
    }
  }

  return (
    <section className="stats-admin">
      <div className="section-header">
        <h2>Besucherstatistik</h2>
        <button type="button" className="btn-ghost" onClick={exportCsv} disabled={!data}>
          Als CSV
        </button>
      </div>
      <RangePicker range={range} onChange={setRange} today={data?.today} />
      {error && <p className="error">{error}</p>}
      {exportError && <p className="error">{exportError}</p>}
      {loading && !data && <p className="hint">Lade …</p>}
      {data && (
        <div className={loading ? 'stats-body is-loading' : 'stats-body'}>
          <StatsCards data={data} />
          <p className="hint">
            Ohne Cookies und ohne IP-Speicherung gemessen, daher sind es Schätzungen. Besucher mit „Do Not Track“ und Bots sind
            nicht enthalten. Der heutige Tag ist noch unvollständig und fließt nicht in Durchschnitte und Vergleiche ein.
          </p>

          <h3>{byMonth ? 'Pro Monat' : 'Pro Tag'}</h3>
          {noData ? (
            <p className="stats-empty">Noch keine Daten in diesem Zeitraum.</p>
          ) : (
            <>
              <StatsChart perDay={data.perDay} byMonth={byMonth} />
              <StatsDayTable perDay={data.perDay} byMonth={byMonth} />
            </>
          )}

          <StatsBreakdown groups={data.groups} weekday={data.weekday} />

          <h3>Beliebteste Seiten</h3>
          {data.topPages.length === 0 ? (
            <p>Noch keine Daten.</p>
          ) : (
            <div className="stats-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Seite</th>
                    <th>Aufrufe</th>
                    <th>Besucher</th>
                    <th>Ø Dauer</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topPages.map((p) => (
                    <tr key={p.path}>
                      <td>{p.path}</td>
                      <td>{formatInt(p.views)}</td>
                      <td>{formatInt(p.visitors)}</td>
                      <td>{formatDuration(p.avgSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
