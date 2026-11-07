const FORMAT_LABELS = {
  online: 'Online',
  onsite: 'Vor Ort',
  hybrid: 'Hybrid',
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// reasons: optionale Begründungen aus "Für dich" (z. B. ["Kategorie Consulting", "in München"])
export default function EventCard({ event, reasons }) {
  return (
    <article className="event-card">
      <div className="event-card-badges">
        <div className="event-card-category">{event.category}</div>
        {FORMAT_LABELS[event.format] && (
          <div className={`event-card-format is-${event.format}`}>{FORMAT_LABELS[event.format]}</div>
        )}
      </div>
      <h3 className="event-card-title">
        {event.url ? (
          <a href={event.url} target="_blank" rel="noopener noreferrer">
            {event.title}
          </a>
        ) : (
          event.title
        )}
      </h3>
      <div className="event-card-meta">
        <span>{formatDate(event.start_date)}</span>
        {event.location && <span>{event.location}</span>}
      </div>
      {reasons?.length > 0 && <p className="event-card-reasons">Warum: {reasons.join(' · ')}</p>}
      {event.description && <p className="event-card-desc">{event.description}</p>}
      {event.tags?.length > 0 && (
        <div className="event-card-tags">
          {event.tags.map((t) => (
            <span key={t} className="tag-pill">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="event-card-source">Quelle: {event.source === 'manual' ? 'Manuell eingereicht' : event.source}</div>
      {event.also_listed?.length > 0 && (
        <div className="event-card-also">
          Auch bei:{' '}
          {event.also_listed.map((l, i) => (
            <span key={l.source}>
              {i > 0 && ', '}
              {l.url ? (
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.source === 'manual' ? 'Manuell eingereicht' : l.source}
                </a>
              ) : l.source === 'manual' ? (
                'Manuell eingereicht'
              ) : (
                l.source
              )}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
