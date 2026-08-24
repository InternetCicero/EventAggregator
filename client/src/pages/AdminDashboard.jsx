import { useEffect, useState } from 'react';
import { api } from '../api';

function LoginForm({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.admin.login(user, pass);
      onLogin();
    } catch {
      setError('Login fehlgeschlagen. Nutzername/Passwort prüfen.');
    }
  }

  return (
    <form className="admin-login" onSubmit={handleSubmit}>
      <h1>Admin-Login</h1>
      <label>
        Nutzername
        <input value={user} onChange={(e) => setUser(e.target.value)} required />
      </label>
      <label>
        Passwort
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required />
      </label>
      <button type="submit">Einloggen</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function PendingQueue() {
  const [status, setStatus] = useState('pending');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    api.admin
      .getEvents(status)
      .then(setEvents)
      .finally(() => setLoading(false));
  }

  useEffect(reload, [status]);

  return (
    <section>
      <div className="section-header">
        <h2>Events</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Ausstehend</option>
          <option value="approved">Freigegeben</option>
          <option value="rejected">Abgelehnt</option>
        </select>
      </div>
      {loading && <p className="hint">Lädt…</p>}
      {!loading && events.length === 0 && <p className="hint">Keine Events in diesem Status.</p>}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Titel</th>
            <th>Kategorie</th>
            <th>Start</th>
            <th>Quelle</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.title}</td>
              <td>{e.category}</td>
              <td>{e.start_date}</td>
              <td>{e.source}</td>
              <td className="admin-actions">
                {status !== 'approved' && (
                  <button onClick={() => api.admin.approve(e.id).then(reload)}>Freigeben</button>
                )}
                {status !== 'rejected' && (
                  <button className="btn-ghost" onClick={() => api.admin.reject(e.id).then(reload)}>
                    Ablehnen
                  </button>
                )}
                <button
                  className="btn-danger"
                  onClick={() => {
                    if (confirm('Event wirklich löschen?')) api.admin.deleteEvent(e.id).then(reload);
                  }}
                >
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const emptySource = {
  name: '',
  base_url: '',
  list_url: '',
  item_selector: '',
  title_selector: '',
  date_selector: '',
  location_selector: '',
  link_selector: '',
  link_attr: 'href',
  description_selector: '',
  category: 'Sonstiges',
  default_tags: '',
};

function SourceManager() {
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptySource);
  const [runResults, setRunResults] = useState({});
  const [showForm, setShowForm] = useState(false);

  function reload() {
    api.admin.getSources().then(setSources);
  }

  useEffect(() => {
    reload();
    api.getCategories().then(setCategories);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    await api.admin.createSource(form);
    setForm(emptySource);
    setShowForm(false);
    reload();
  }

  async function handleRun(id) {
    setRunResults((r) => ({ ...r, [id]: 'läuft…' }));
    try {
      const result = await api.admin.runSource(id);
      setRunResults((r) => ({
        ...r,
        [id]: `${result.inserted} neu, ${result.skipped} Duplikate, ${result.failed} Fehler (von ${result.total})`,
      }));
      reload();
    } catch (err) {
      setRunResults((r) => ({ ...r, [id]: `Fehler: ${err.message}` }));
    }
  }

  return (
    <section>
      <div className="section-header">
        <h2>Automatische Quellen</h2>
        <div>
          <button
            className="btn-ghost"
            onClick={async () => {
              const results = await api.admin.runAllSources();
              alert(
                results
                  .map((r) => `${r.source}: ${r.error ? r.error : `${r.inserted} neu`}`)
                  .join('\n')
              );
              reload();
            }}
          >
            Alle jetzt ausführen
          </button>
          <button onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Abbrechen' : '+ Neue Quelle'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="source-form" onSubmit={handleCreate}>
          <p className="hint">
            Konfiguriere CSS-Selektoren für eine Event-Listing-Seite. Die Selektoren wirken relativ zu
            jedem gefundenen Listen-Element (item_selector).
          </p>
          <div className="form-row">
            <label>
              Name *
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Kategorie (Standard für alle Events dieser Quelle)
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Basis-URL * (für relative Links)
              <input
                required
                placeholder="https://example.com"
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              />
            </label>
            <label>
              Listen-URL * (Seite mit der Event-Übersicht)
              <input
                required
                placeholder="https://example.com/events"
                value={form.list_url}
                onChange={(e) => setForm({ ...form, list_url: e.target.value })}
              />
            </label>
          </div>
          <label>
            Item-Selector * (ein CSS-Selektor pro Event-Eintrag, z. B. ".event-item")
            <input
              required
              value={form.item_selector}
              onChange={(e) => setForm({ ...form, item_selector: e.target.value })}
            />
          </label>
          <div className="form-row">
            <label>
              Titel-Selector *
              <input
                required
                value={form.title_selector}
                onChange={(e) => setForm({ ...form, title_selector: e.target.value })}
              />
            </label>
            <label>
              Datum-Selector (optional, liest text/datetime/content-Attribut)
              <input
                value={form.date_selector}
                onChange={(e) => setForm({ ...form, date_selector: e.target.value })}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Ort-Selector (optional)
              <input
                value={form.location_selector}
                onChange={(e) => setForm({ ...form, location_selector: e.target.value })}
              />
            </label>
            <label>
              Beschreibung-Selector (optional)
              <input
                value={form.description_selector}
                onChange={(e) => setForm({ ...form, description_selector: e.target.value })}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Link-Selector (optional, sonst ganzes Item als Link)
              <input
                value={form.link_selector}
                onChange={(e) => setForm({ ...form, link_selector: e.target.value })}
              />
            </label>
            <label>
              Link-Attribut
              <input
                value={form.link_attr}
                onChange={(e) => setForm({ ...form, link_attr: e.target.value })}
              />
            </label>
          </div>
          <label>
            Standard-Tags (mit Komma getrennt)
            <input
              value={form.default_tags}
              onChange={(e) => setForm({ ...form, default_tags: e.target.value })}
            />
          </label>
          <button type="submit">Quelle speichern</button>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Listen-URL</th>
            <th>Letzter Lauf</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>
                <a href={s.list_url} target="_blank" rel="noopener noreferrer">
                  {s.list_url}
                </a>
              </td>
              <td>
                {s.last_run_at ? `${s.last_run_at} — ${s.last_run_status}` : 'noch nie'}
                {runResults[s.id] && <div className="hint">{runResults[s.id]}</div>}
              </td>
              <td className="admin-actions">
                <button onClick={() => handleRun(s.id)}>Jetzt ausführen</button>
                <button
                  className="btn-danger"
                  onClick={() => {
                    if (confirm('Quelle wirklich löschen?')) api.admin.deleteSource(s.id).then(reload);
                  }}
                >
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function AdminDashboard() {
  const [loggedIn, setLoggedIn] = useState(api.admin.isLoggedIn());

  if (!loggedIn) {
    return <LoginForm onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <div className="admin-page">
      <div className="section-header">
        <h1>Admin-Bereich</h1>
        <button
          className="btn-ghost"
          onClick={() => {
            api.admin.logout();
            setLoggedIn(false);
          }}
        >
          Ausloggen
        </button>
      </div>
      <PendingQueue />
      <SourceManager />
    </div>
  );
}
