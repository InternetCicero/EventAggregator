import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import JobCard from '../components/JobCard';
import { DEGREE_LABELS, WORK_MODE_LABELS } from '../lib/jobLabels';

const emptyFilters = {
  search: '',
  job_type: '',
  degree_level: '',
  semester: '',
  work_mode: '',
  paid: '',
  language: '',
  sector: '',
  location: '',
  salary_given: '',
};

export default function JobList() {
  const [meta, setMeta] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getJobsMeta().then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getJobs(filters)
      .then(setJobs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  function set(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
  }

  const anyFilter = Object.values(filters).some(Boolean);

  return (
    <div className="event-list-page">
      <div className="page-intro">
        <h1>Jobs & Praktika</h1>
        <p className="hint">
          Kuratiert und empfohlen aus dem Netzwerk. Etwas Passendes gesehen?{' '}
          <Link to="/jobs/einreichen">Stelle einreichen</Link>
        </p>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Suche nach Titel, Firma, Beschreibung…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
        <select value={filters.job_type} onChange={(e) => set('job_type', e.target.value)}>
          <option value="">Alle Stellenarten</option>
          {meta?.jobTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select value={filters.degree_level} onChange={(e) => set('degree_level', e.target.value)}>
          <option value="">Jeder Abschluss</option>
          <option value="bachelor">{DEGREE_LABELS.bachelor}</option>
          <option value="master">{DEGREE_LABELS.master}</option>
        </select>
        <label>
          Mein Semester
          <input
            type="number"
            min="1"
            max="20"
            className="input-narrow"
            value={filters.semester}
            onChange={(e) => set('semester', e.target.value)}
          />
        </label>
        <select value={filters.work_mode} onChange={(e) => set('work_mode', e.target.value)}>
          <option value="">Vor Ort, hybrid & remote</option>
          {Object.entries(WORK_MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={filters.paid} onChange={(e) => set('paid', e.target.value)}>
          <option value="">Bezahlt & unbezahlt</option>
          <option value="yes">Nur bezahlt</option>
          <option value="no">Nur unbezahlt</option>
        </select>
        <select value={filters.language} onChange={(e) => set('language', e.target.value)}>
          <option value="">Alle Sprachen</option>
          {meta?.languages.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <select value={filters.sector} onChange={(e) => set('sector', e.target.value)}>
          <option value="">Alle Branchen</option>
          {meta?.sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Ort"
          className="input-narrow-text"
          value={filters.location}
          onChange={(e) => set('location', e.target.value)}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={filters.salary_given === '1'}
            onChange={(e) => set('salary_given', e.target.checked ? '1' : '')}
          />
          Gehalt angegeben
        </label>
        {anyFilter && (
          <button className="btn-ghost" onClick={() => setFilters(emptyFilters)}>
            Filter zurücksetzen
          </button>
        )}
      </div>

      {loading && <p className="hint">Lade Stellen…</p>}
      {error && <p className="error">Fehler: {error}</p>}
      {!loading && !error && jobs.length === 0 && (
        <p className="hint">
          Keine Stellen gefunden.{' '}
          {!anyFilter && (
            <>
              Kennst du eine? <Link to="/jobs/einreichen">Jetzt einreichen</Link>
            </>
          )}
        </p>
      )}

      <div className="event-grid">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} meta={meta} />
        ))}
      </div>
    </div>
  );
}
