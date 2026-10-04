import { Link } from 'react-router-dom';
import { DEGREE_LABELS, factChips, formatDate, jobTypeLabel } from '../lib/jobLabels';

export default function JobCard({ job, meta }) {
  const chips = factChips(job);
  return (
    <article className="event-card job-card">
      <div className="event-card-badges">
        <div className="event-card-category">{jobTypeLabel(meta, job.job_type)}</div>
        {job.degree_level && <div className="event-card-format">{DEGREE_LABELS[job.degree_level]}</div>}
      </div>
      <h3 className="event-card-title">
        <Link to={`/jobs/${job.id}`}>{job.title}</Link>
      </h3>
      <div className="event-card-meta">
        <span className="job-card-company">{job.company?.name || job.company_name}</span>
        {job.location && <span>{job.location}</span>}
        {job.deadline && <span>Bewerben bis {formatDate(job.deadline)}</span>}
      </div>
      {chips.length > 0 && (
        <div className="event-card-tags">
          {chips.map((c) => (
            <span key={c} className="tag-pill">
              {c}
            </span>
          ))}
        </div>
      )}
      {job.referrer_name && (
        <div className="event-card-source">Empfohlen von {job.referrer_name}</div>
      )}
    </article>
  );
}
