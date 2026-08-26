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

export default function EventCard({ event }) {
  return (
    <article className="event-card">
      <div className="event-card-category">{event.category}</div>
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
    </article>
  );
}
