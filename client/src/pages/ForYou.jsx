import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import EventCard from '../components/EventCard';
import ProfileEditor from '../components/ProfileEditor';
import SectionTabs from '../components/SectionTabs';
import { EVENT_TABS } from '../lib/sections';
import { rankEvents } from '../lib/matching';
import { todayIso } from '../lib/matching/dates';
import { clearProfile, emptyProfile, isActive, loadProfile, saveProfile } from '../lib/matching/profile';

// Schon der Zugriff auf window.localStorage kann werfen (z. B. gesperrte Website-Daten)
function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function ProfileSummary({ profile, onEdit }) {
  const parts = [
    profile.categories.join(', '),
    profile.keywords.map((k) => `„${k}“`).join(', '),
    [profile.cities.primary, profile.cities.secondary].filter(Boolean).join(' / '),
    `nächste ${profile.horizonDays} Tage`,
  ].filter(Boolean);
  return (
    <div className="profile-summary">
      <p>
        <strong>Dein Profil:</strong> {parts.join(' · ')}
      </p>
      <button type="button" className="btn-ghost" onClick={onEdit}>
        Profil bearbeiten
      </button>
    </div>
  );
}

function ResultGroup({ title, results }) {
  if (!results.length) return null;
  return (
    <section className="for-you-group">
      <h2 className="day-heading">
        {title} <span className="for-you-count">({results.length})</span>
      </h2>
      <div className="event-grid">
        {results.map((r) => (
          <EventCard key={r.item.id} event={r.item} reasons={r.reasons} />
        ))}
      </div>
    </section>
  );
}

export default function ForYou() {
  const [categories, setCategories] = useState([]);
  const [formats, setFormats] = useState([]);
  const [tags, setTags] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [saved, setSaved] = useState(() => loadProfile(browserStorage()));
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
    api.getFormats().then(setFormats).catch(() => {});
    api.getTags().then(setTags).catch(() => {});
    // Dieselbe Anfrage wie "Alle Events": ohne Profilangaben (Spec AC-10)
    api
      .getEvents({})
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const active = isActive(saved);
  const result = useMemo(() => rankEvents(events, saved, { today: todayIso() }), [events, saved]);

  function handleSave() {
    const stored = saveProfile(browserStorage(), draft, { categories });
    if (stored) {
      setSaved(stored);
      setDraft(stored);
      setStorageError(false);
    } else {
      // Speicher gesperrt (z. B. privater Modus): für diese Sitzung trotzdem nutzen
      setSaved({ ...draft });
      setStorageError(true);
    }
    setEditing(false);
  }

  function handleDelete() {
    if (!confirm('Profil wirklich löschen? Es wird nur auf diesem Gerät gespeichert und lässt sich nicht wiederherstellen.')) {
      return;
    }
    clearProfile(browserStorage());
    setSaved(emptyProfile());
    setDraft(emptyProfile());
    setEditing(false);
  }

  const showEditor = !active || editing;
  const hasResults = result.top.length + result.maybe.length > 0;

  return (
    <div className="event-list-page for-you-page">
      <SectionTabs tabs={EVENT_TABS} label="Events" />
      <div className="page-intro">
        <h1>Für dich</h1>
        <p className="hint">
          Events, die zu deinen Interessen passen. Dein Profil bleibt auf diesem Gerät und wird nicht an unseren Server
          geschickt. <Link to="/datenschutz">Mehr dazu</Link>
        </p>
      </div>

      {storageError && (
        <p className="hint">
          Dein Browser erlaubt kein Speichern. Das Profil gilt deshalb nur, bis du die Seite schließt.
        </p>
      )}

      {showEditor ? (
        <ProfileEditor
          draft={draft}
          onChange={setDraft}
          categories={categories}
          tags={tags}
          formats={formats}
          onSave={handleSave}
          onCancel={
            active
              ? () => {
                  setDraft(saved);
                  setEditing(false);
                }
              : null
          }
          onDelete={saved.updatedAt || active ? handleDelete : null}
        />
      ) : (
        <ProfileSummary
          profile={saved}
          onEdit={() => {
            setDraft(saved);
            setEditing(true);
          }}
        />
      )}

      {active && !editing && (
        <>
          {loading && <p className="hint">Lade Events…</p>}
          {error && <p className="error">Fehler: {error}</p>}
          {!loading && !error && !hasResults && (
            <p className="hint">
              Gerade passt kein kommendes Event gut zu deinem Profil. Versuch mehr Kategorien, andere Schlagwörter oder
              einen längeren Zeitraum.
            </p>
          )}
          <ResultGroup title="Passt sehr gut" results={result.top} />
          <ResultGroup title="Könnte dich interessieren" results={result.maybe} />
          {!loading && result.otherCount > 0 && (
            <p className="hint for-you-more">
              {result.otherCount} weitere {result.otherCount === 1 ? 'Event passt' : 'Events passen'} weniger gut.{' '}
              <Link to="/">Alle Events ansehen</Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
