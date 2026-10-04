import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import EventCard from '../components/EventCard';
import EventFilters from '../components/EventFilters';
import { emptyEventFilters } from '../lib/eventFilters';

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formats, setFormats] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState(emptyEventFilters);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
    api.getFormats().then(setFormats).catch(() => {});
    api.getTags().then(setAllTags).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getEvents(filters)
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const groupedByDate = useMemo(() => {
    const groups = {};
    for (const e of events) {
      const day = (e.start_date || '').slice(0, 10);
      if (!groups[day]) groups[day] = [];
      groups[day].push(e);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  return (
    <div className="event-list-page">
      <EventFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        formats={formats}
        tags={allTags}
        resultCount={loading ? null : events.length}
      />

      {error && <p className="error">Fehler: {error}</p>}
      {!loading && !error && events.length === 0 && (
        <p className="hint">
          Keine Events gefunden.{' '}
          {Object.values(filters).some(Boolean) && (
            <button type="button" className="link-button" onClick={() => setFilters(emptyEventFilters)}>
              Filter zurücksetzen
            </button>
          )}
        </p>
      )}

      {groupedByDate.map(([day, dayEvents]) => (
        <section key={day} className="day-group">
          <h2 className="day-heading">
            {new Date(day).toLocaleDateString('de-DE', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <div className="event-grid">
            {dayEvents.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
