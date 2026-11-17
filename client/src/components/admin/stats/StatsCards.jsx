import { fullLabel, formatChange, formatDecimal, formatDuration, formatInt, percentChange } from '../../../lib/statsMath';

function Card({ value, label, sub, change }) {
  return (
    <div className="stats-card">
      <strong>{value}</strong>
      <span className="stats-card-label">{label}</span>
      {change !== undefined && <span className="stats-card-change">{change}</span>}
      {sub && <span className="stats-card-sub">{sub}</span>}
    </div>
  );
}

export default function StatsCards({ data }) {
  const { completed, previous, todayStats, yesterdayStats, peak, totals } = data;
  const prevNote = `zu den ${previous.days} Tagen davor`;
  const change = (current, prev) => `${formatChange(percentChange(current, prev, previous.visitors))} ${prevNote}`;

  return (
    <div className="stats-cards">
      <Card value={formatInt(todayStats.visitors)} label="Besucher heute" sub={`läuft noch · ${formatInt(todayStats.views)} Aufrufe`} />
      <Card value={formatInt(yesterdayStats.visitors)} label="Besucher gestern" sub={`${formatInt(yesterdayStats.views)} Aufrufe`} />
      <Card
        value={formatDecimal(completed.visitorsPerDay)}
        label="Ø Besucher pro Tag"
        sub={`aus ${completed.days} abgeschlossenen Tagen`}
        change={change(completed.visitorsPerDay, previous.visitorsPerDay)}
      />
      <Card
        value={peak ? formatInt(peak.visitors) : '–'}
        label="Spitzentag (Besucher)"
        sub={peak ? fullLabel(peak.day) : 'noch keine Daten'}
      />
      <Card
        value={formatInt(totals.visitors)}
        label="Besucher im Zeitraum (Summe der Tage)"
        sub="Wer an mehreren Tagen kommt, zählt mehrfach"
      />
      <Card
        value={formatDecimal(completed.viewsPerVisitor)}
        label="Aufrufe pro Besucher"
        change={change(completed.viewsPerVisitor, previous.viewsPerVisitor)}
      />
      <Card
        value={formatDuration(completed.avgSeconds)}
        label="Ø Verweildauer pro Aufruf"
        change={change(completed.avgSeconds, previous.avgSeconds)}
      />
    </div>
  );
}
