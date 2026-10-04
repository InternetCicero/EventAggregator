import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import JobCard from '../components/JobCard';
import JobFilters from '../components/JobFilters';
import { emptyJobFilters } from '../lib/jobForm';

export default function JobList() {
  const [meta, setMeta] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState(emptyJobFilters);
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

      <JobFilters filters={filters} onChange={setFilters} meta={meta} resultCount={loading ? null : jobs.length} />

      {error && <p className="error">Fehler: {error}</p>}
      {!loading && !error && jobs.length === 0 && (
        <p className="hint">
          {anyFilter ? (
            <>
              Keine Stellen zu diesen Filtern.{' '}
              <button type="button" className="link-button" onClick={() => setFilters(emptyJobFilters)}>
                Filter zurücksetzen
              </button>
            </>
          ) : (
            <>
              Noch keine Stellen. Kennst du eine? <Link to="/jobs/einreichen">Jetzt einreichen</Link>
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
