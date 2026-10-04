import { useEffect, useState } from 'react';
import { api } from '../../api';
import { SIZE_LABELS } from '../../lib/jobLabels';

const emptyCompany = { name: '', website: '', sector: '', size_bucket: '' };

export default function CompaniesAdmin() {
  const [companies, setCompanies] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState(emptyCompany);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  function reload() {
    api.admin.getCompanies().then(setCompanies);
  }

  useEffect(() => {
    reload();
    api.getJobsMeta().then((m) => setSectors(m.sectors));
  }, []);

  function startEdit(company) {
    setEditingId(company.id);
    setForm({
      name: company.name,
      website: company.website || '',
      sector: company.sector || '',
      size_bucket: company.size_bucket || '',
    });
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyCompany);
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) await api.admin.updateCompany(editingId, form);
      else await api.admin.createCompany(form);
      closeForm();
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <div className="section-header">
        <h2>Firmen</h2>
        <button onClick={showForm ? closeForm : () => setShowForm(true)}>{showForm ? 'Abbrechen' : '+ Neue Firma'}</button>
      </div>

      {showForm && (
        <form className="source-form" onSubmit={handleSave}>
          <div className="form-row">
            <label>
              Name *
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Website
              <input
                type="url"
                placeholder="https://…"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Branche
              <select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                <option value="">Keine Angabe</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Größe
              <select value={form.size_bucket} onChange={(e) => setForm({ ...form, size_bucket: e.target.value })}>
                <option value="">Keine Angabe</option>
                {Object.entries(SIZE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit">{editingId ? 'Änderungen speichern' : 'Firma anlegen'}</button>
          {error && <p className="error">Fehler: {error}</p>}
        </form>
      )}

      {companies.length === 0 ? (
        <p className="hint">Noch keine Firmen angelegt.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Branche</th>
              <th>Größe</th>
              <th>Stellen</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.website ? (
                    <a href={c.website} target="_blank" rel="noopener noreferrer">
                      {c.name}
                    </a>
                  ) : (
                    c.name
                  )}
                </td>
                <td>{c.sector || '–'}</td>
                <td>{SIZE_LABELS[c.size_bucket] || '–'}</td>
                <td>{c.job_count}</td>
                <td className="admin-actions">
                  <button className="btn-ghost" onClick={() => startEdit(c)}>
                    Bearbeiten
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => {
                      if (confirm(`Firma „${c.name}“ löschen? Zugeordnete Stellen bleiben erhalten.`)) {
                        api.admin.deleteCompany(c.id).then(reload);
                      }
                    }}
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
