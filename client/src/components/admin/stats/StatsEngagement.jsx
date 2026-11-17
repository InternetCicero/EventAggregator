import { availabilityNote, formatInt, groupShares, peakHour, percentOf } from '../../../lib/statsMath';

const DURATION_LABELS = [
  ['short', 'unter 10 s'],
  ['mid', '10 bis 60 s'],
  ['long', '1 bis 5 min'],
  ['xlong', 'über 5 min'],
];
const DEVICE_LABELS = { mobile: 'Handy', tablet: 'Tablet', desktop: 'Desktop', other: 'Sonstige' };

function Note({ children }) {
  return children ? <p className="hint">{children}</p> : null;
}

export default function StatsEngagement({ data }) {
  const { engagement, hours, devices, availability, from } = data;

  const durTotal = Object.values(engagement.durations).reduce((a, b) => a + b, 0);
  const durShares = groupShares(DURATION_LABELS.map(([key]) => ({ key, views: engagement.durations[key] })));
  const singlePct = percentOf(engagement.singleVisitors, engagement.visitors);

  const hourTotal = hours.views.reduce((a, b) => a + b, 0);
  const hourMax = Math.max(1, ...hours.views);
  const peak = peakHour(hours.views);

  const devTotal = devices.mobile + devices.tablet + devices.desktop + devices.other;
  const devShares = groupShares(Object.keys(DEVICE_LABELS).map((key) => ({ key, views: devices[key] })));

  return (
    <div className="stats-engagement">
      <section>
        <h3>Wie lange bleiben sie?</h3>
        {durTotal === 0 ? (
          <Note>{availabilityNote(availability.engagementFrom, from, false)}</Note>
        ) : (
          <>
            <div className="stats-stack" role="img" aria-label="Verteilung der Verweildauer pro Aufruf">
              {durShares.map((d, i) => (
                <i key={d.key} className={`is-step-${i}`} style={{ width: `${d.percent}%` }} />
              ))}
            </div>
            <ul className="stats-legend-list">
              {durShares.map((d, i) => (
                <li key={d.key}>
                  <i className={`stats-dot is-step-${i}`} />
                  <span>{DURATION_LABELS[i][1]}</span>
                  <strong>{d.percent} %</strong>
                </li>
              ))}
            </ul>
            <p className="stats-fact">
              <strong>{singlePct} %</strong> der Besucher sehen nur eine Seite ({formatInt(engagement.singleVisitors)} von{' '}
              {formatInt(engagement.visitors)}). Das ist eine Näherung der Absprungrate.
            </p>
            <Note>{availabilityNote(availability.engagementFrom, from, true)}</Note>
          </>
        )}
      </section>

      <section>
        <h3>Wann sind sie da?</h3>
        {hourTotal === 0 ? (
          <Note>{availabilityNote(availability.hoursFrom, from, false)}</Note>
        ) : (
          <>
            <div className="stats-hours" role="img" aria-label="Aufrufe nach Tageszeit">
              {hours.views.map((v, h) => (
                <span
                  key={h}
                  className={h === peak ? 'stats-hour is-peak' : 'stats-hour'}
                  title={`${h}:00 bis ${h + 1}:00 Uhr: ${percentOf(v, hourTotal)} % der Aufrufe`}
                >
                  <i style={{ height: `${Math.round((v / hourMax) * 100)}%` }} />
                </span>
              ))}
            </div>
            <div className="stats-hours-axis" aria-hidden="true">
              <span>0 Uhr</span>
              <span>6</span>
              <span>12</span>
              <span>18</span>
              <span>24</span>
            </div>
            {peak !== null && (
              <p className="stats-fact">
                Die meisten Aufrufe kommen zwischen <strong>{peak} und {peak + 1} Uhr</strong> ({percentOf(hours.views[peak], hourTotal)} %).
              </p>
            )}
            <Note>{availabilityNote(availability.hoursFrom, from, true)}</Note>
          </>
        )}
      </section>

      <section>
        <h3>Welche Geräte?</h3>
        {devTotal === 0 ? (
          <Note>{availabilityNote(availability.devicesFrom, from, false)}</Note>
        ) : (
          <>
            <ul className="stats-groups">
              {devShares.map((d) => (
                <li key={d.key}>
                  <span className="stats-group-name">{DEVICE_LABELS[d.key]}</span>
                  <span className="stats-group-track" aria-hidden="true">
                    <i style={{ width: `${d.percent}%` }} />
                  </span>
                  <span className="stats-group-value">
                    {d.percent} % · {formatInt(d.views)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="hint">Nur die grobe Kategorie wird gezählt, die Browserkennung wird nicht gespeichert.</p>
            <Note>{availabilityNote(availability.devicesFrom, from, true)}</Note>
          </>
        )}
      </section>
    </div>
  );
}
