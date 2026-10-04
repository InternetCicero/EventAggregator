import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import JobFields from '../JobFields';
import { jobToForm } from '../../lib/jobForm';
import { jobTypeLabel } from '../../lib/jobLabels';

const BULK_LABELS = { approve: 'freigeben', reject: 'ablehnen', delete: 'löschen' };
const SOURCE_KIND_LABELS = { member: 'Member', company: 'Firma', admin: 'Admin' };

function JobEditor({ job, meta, companies, onSaved, onCancel }) {
  const [form, setForm] = useState(() => jobToForm(job));
  // Ohne Zuordnung die Firma vorschlagen, deren Name exakt passt
  const [companyId, setCompanyId] = useState(() => {
    if (job.company_id) return String(job.company_id);
    const match = companies.find((c) => c.name.toLowerCase() === job.company_name.toLowerCase());
    return match ? String(match.id) : '';
  });
  const [sourceKind, setSourceKind] = useState(job.source_kind);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.admin.updateJob(job.id, { ...form, company_id: companyId || null, source_kind: sourceKind });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="event-form job-form admin-job-editor" onSubmit={handleSave}>
      <div className="section-header">
        <h2>Stelle bearbeiten</h2>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Schließen
        </button>
      </div>
      {job.submitter_name && <p className="hint">Eingereicht von: {job.submitter_name}</p>}
      <div className="form-row">
        <label>
          Zugeordnete Firma
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">– keine –</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Herkunft
          <select value={sourceKind} onChange={(e) => setSourceKind(e.target.value)}>
            {Object.entries(SOURCE_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <JobFields form={form} update={update} meta={meta} />
      <button type="submit" disabled={saving}>
        {saving ? 'Speichert…' : 'Änderungen speichern'}
      </button>
      {error && <p className="error">Fehler: {error}</p>}
    </form>
  );
}

export default function JobsAdmin() {
  const [status, setStatus] = useState('pending');
  const [jobs, setJobs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editing, setEditing] = useState(null);

  function reload() {
    setLoading(true);
    setSelected(new Set());
    api.admin
      .getJobs(status)
      .then(setJobs)
      .finally(() => setLoading(false));
  }

  useEffect(reload, [status]);
  useEffect(() => {
    api.getJobsMeta().then(setMeta);
    api.admin.getCompanies().then(setCompanies);
  }, []);

  const allSelected = jobs.length > 0 && selected.size === jobs.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action, ids = [...selected]) {
    if (ids.length === 0) return;
    if (action === 'delete' && !confirm(`${ids.length} Stelle(n) wirklich löschen?`)) return;
    setBulkBusy(true);
    try {
      await api.admin.bulkJobAction(ids, action);
      if (editing && ids.includes(editing.id)) setEditing(null);
      reload();
    } catch (err) {
      alert(`Aktion "${BULK_LABELS[action]}" fehlgeschlagen: ${err.message}`);
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <section>
      <div className="section-header">
        <h2>Stellen</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Ausstehend</option>
          <option value="approved">Freigegeben</option>
          <option value="rejected">Abgelehnt</option>
          <option value="expired">Abgelaufen</option>
        </select>
      </div>

      {jobs.length > 0 && (
        <div className="bulk-bar">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => el && (el.indeterminate = someSelected)}
              onChange={() => setSelected(allSelected ? new Set() : new Set(jobs.map((j) => j.id)))}
            />
            {selected.size > 0 ? `${selected.size} ausgewählt` : 'Alle auswählen'}
          </label>
          <div className="bulk-bar-actions">
            {status !== 'approved' && (
              <button disabled={selected.size === 0 || bulkBusy} onClick={() => runBulk('approve')}>
                Ausgewählte freigeben
              </button>
            )}
            {status !== 'rejected' && (
              <button className="btn-ghost" disabled={selected.size === 0 || bulkBusy} onClick={() => runBulk('reject')}>
                Ausgewählte ablehnen
              </button>
            )}
            <button className="btn-danger" disabled={selected.size === 0 || bulkBusy} onClick={() => runBulk('delete')}>
              Ausgewählte löschen
            </button>
          </div>
        </div>
      )}

      {loading && <p className="hint">Lädt…</p>}
      {!loading && jobs.length === 0 && <p className="hint">Keine Stellen in diesem Status.</p>}
      {jobs.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-table-checkbox"></th>
              <th>Titel</th>
              <th>Firma</th>
              <th>Art</th>
              <th>Herkunft</th>
              <th>Eingereicht</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className={selected.has(j.id) ? 'is-selected' : undefined}>
                <td className="admin-table-checkbox">
                  <input type="checkbox" checked={selected.has(j.id)} onChange={() => toggleOne(j.id)} />
                </td>
                <td>
                  {status === 'approved' ? <Link to={`/jobs/${j.id}`}>{j.title}</Link> : j.title}
                </td>
                <td>
                  {j.company ? j.company.name : <span className="hint">{j.company_name} (nicht zugeordnet)</span>}
                </td>
                <td>{jobTypeLabel(meta, j.job_type)}</td>
                <td>
                  {SOURCE_KIND_LABELS[j.source_kind]}
                  {j.submitter_name && <div className="hint">{j.submitter_name}</div>}
                </td>
                <td>{j.created_at?.slice(0, 10)}</td>
                <td className="admin-actions">
                  <button className="btn-ghost" onClick={() => setEditing(j)}>
                    Bearbeiten
                  </button>
                  {status !== 'approved' && (
                    <button disabled={bulkBusy} onClick={() => runBulk('approve', [j.id])}>
                      Freigeben
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && meta && (
        <JobEditor
          key={editing.id}
          job={editing}
          meta={meta}
          companies={companies}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </section>
  );
}
