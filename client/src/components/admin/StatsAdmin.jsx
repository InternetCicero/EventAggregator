import { useEffect, useState } from 'react';
import { api } from '../../api';

const RANGES = [7, 30, 90];

function formatDuration(seconds) {
  if (!seconds) return '–';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} Min ${s} s` : `${s} s`;
}

export default function StatsAdmin() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api.admin
      .getStats(days)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [days]);

  const maxViews = data ? Math.max(1, ...data.perDay.map((d) => d.views)) : 1;

  return (
    <section>
      <div className="section-header">
        <h2>Besucherstatistik</h2>
        <div className="mode-switch">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={days === r ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setDays(r)}
            >
              {r} Tage
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <div className="stats-cards">
            <div className="stats-card">
              <strong>{data.totals.visitors}</strong>
              <span>Besucher (Summe der Tage)</span>
            </div>
            <div className="stats-card">
              <strong>{data.totals.views}</strong>
              <span>Seitenaufrufe</span>
            </div>
            <div className="stats-card">
              <strong>{formatDuration(data.totals.avgSeconds)}</strong>
              <span>Ø Verweildauer pro Aufruf</span>
            </div>
          </div>
          <p className="hint">
            Ohne Cookies und ohne IP-Speicherung gemessen. Wer an mehreren Tagen kommt, zählt pro Tag einmal. Besucher mit
            „Do Not Track“ und Bots sind nicht enthalten.
          </p>

          <h3>Pro Tag</h3>
          <div className="stats-days" role="img" aria-label="Seitenaufrufe pro Tag">
            {data.perDay.map((d) => (
              <div
                key={d.day}
                className="stats-bar"
                style={{ height: `${Math.round((d.views / maxViews) * 100)}%` }}
                title={`${d.day}: ${d.visitors} Besucher, ${d.views} Aufrufe`}
              />
            ))}
          </div>

          <h3>Beliebteste Seiten</h3>
          {data.topPages.length === 0 ? (
            <p>Noch keine Daten.</p>
          ) : (
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
                    <td>{p.views}</td>
                    <td>{p.visitors}</td>
                    <td>{formatDuration(p.avgSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
