import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import EventCard from '../components/EventCard';

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
    api.getTags().then(setAllTags).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = { category, tag, search, from, to };
    api
      .getEvents(params)
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, tag, search, from, to]);

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
      <div className="filters">
        <input
          type="text"
          placeholder="Suche nach Titel, Ort, Beschreibung…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Alle Kategorien</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">Alle Tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
        <label>
          Von
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Bis
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {(category || tag || search || from || to) && (
          <button
            className="btn-ghost"
            onClick={() => {
              setCategory('');
              setTag('');
              setSearch('');
              setFrom('');
              setTo('');
            }}
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {loading && <p className="hint">Lade Events…</p>}
      {error && <p className="error">Fehler: {error}</p>}
      {!loading && !error && events.length === 0 && <p className="hint">Keine Events gefunden.</p>}

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
