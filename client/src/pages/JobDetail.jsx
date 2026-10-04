import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { VibeDisplay } from '../components/VibeSliders';
import {
  DEGREE_LABELS,
  SIZE_LABELS,
  WORK_MODE_LABELS,
  factChips,
  formatDate,
  jobTypeLabel,
} from '../lib/jobLabels';

function Facts({ job, meta }) {
  const languageLabels = job.languages
    .map((code) => meta?.languages.find((l) => l.value === code)?.label || code)
    .join(', ');
  const rows = [
    ['Stellenart', jobTypeLabel(meta, job.job_type)],
    ['Abschluss', DEGREE_LABELS[job.degree_level]],
    ['Ab Semester', job.min_semester],
    ['Ort', job.location],
    ['Arbeitsmodell', WORK_MODE_LABELS[job.work_mode]],
    ['Start', job.start_date ? formatDate(job.start_date) : 'flexibel'],
    ['Dauer', job.duration_months ? `${job.duration_months} Monate` : null],
    ['Sprachen', languageLabels],
    ['Bewerbungsfrist', job.deadline ? formatDate(job.deadline) : null],
    ['Branche', job.company?.sector],
    ['Größe', SIZE_LABELS[job.company?.size_bucket]],
  ].filter(([, v]) => v);
  return (
    <dl className="job-facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getJobsMeta().then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    setJob(null);
    setError(null);
    api.getJob(id).then(setJob).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="job-detail">
        <p className="error">Diese Stelle gibt es nicht (mehr).</p>
        <Link to="/jobs">← Zurück zu allen Stellen</Link>
      </div>
    );
  }
  if (!job) return <p className="hint">Lädt…</p>;

  const chips = factChips(job);
  const answered = (meta?.questions || []).filter((q) => job.answers[q.key]);
  const applyHref = job.apply_url || `mailto:${job.apply_email}`;
  const companyName = job.company?.name || job.company_name;

  return (
    <article className="job-detail">
      <Link to="/jobs" className="back-link">
        ← Alle Stellen
      </Link>

      <header className="job-detail-header">
        <p className="job-detail-company">
          {job.company?.website ? (
            <a href={job.company.website} target="_blank" rel="noopener noreferrer">
              {companyName}
            </a>
          ) : (
            companyName
          )}
        </p>
        <h1>{job.title}</h1>
        {chips.length > 0 && (
          <div className="event-card-tags">
            {chips.map((c) => (
              <span key={c} className="tag-pill">
                {c}
              </span>
            ))}
          </div>
        )}
        <a className="apply-button" href={applyHref} target="_blank" rel="noopener noreferrer">
          Jetzt bewerben
        </a>
      </header>

      <div className="job-detail-grid">
        <div className="job-detail-main">
          {job.referrer_note && (
            <section className="job-box referrer-box">
              <h2>Warum {job.referrer_name || 'jemand aus dem Netzwerk'} diese Stelle empfiehlt</h2>
              <p>{job.referrer_note}</p>
            </section>
          )}

          {job.description && (
            <section className="job-box">
              <h2>Beschreibung</h2>
              <p className="pre-line">{job.description}</p>
            </section>
          )}

          {meta && Object.keys(job.vibe).length > 0 && (
            <section className="job-box">
              <h2>Vibe</h2>
              <VibeDisplay dimensions={meta.dimensions} value={job.vibe} />
            </section>
          )}

          {answered.length > 0 && (
            <section className="job-box">
              <h2>Nachgefragt</h2>
              <dl className="job-answers">
                {answered.map((q) => (
                  <div key={q.key}>
                    <dt>{q.label}</dt>
                    <dd>{job.answers[q.key]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        <aside className="job-detail-side">
          <section className="job-box">
            <h2>Eckdaten</h2>
            <Facts job={job} meta={meta} />
          </section>

          {job.contact_name && (
            <section className="job-box contact-card">
              <h2>Ansprechpartner:in</h2>
              <p className="contact-name">{job.contact_name}</p>
              {job.contact_role && <p className="hint">{job.contact_role}</p>}
              {job.contact_decides === 1 && <p className="contact-decides">Entscheidet bei der Auswahl mit</p>}
              {job.contact_email && <a href={`mailto:${job.contact_email}`}>{job.contact_email}</a>}
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
