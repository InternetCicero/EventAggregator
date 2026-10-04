const db = require('./index');

// Spalten, die beim Anlegen/Bearbeiten aus einem (validierten) Job-Objekt
// übernommen werden. vibe/answers werden als JSON-Text gespeichert.
const WRITABLE_COLUMNS = [
  'company_name',
  'title',
  'description',
  'job_type',
  'degree_level',
  'min_semester',
  'location',
  'work_mode',
  'start_date',
  'duration_months',
  'paid',
  'salary_min',
  'salary_max',
  'languages',
  'apply_url',
  'apply_email',
  'deadline',
  'vibe',
  'answers',
  'referrer_name',
  'referrer_note',
  'contact_name',
  'contact_role',
  'contact_decides',
  'contact_email',
  'contact_consent',
  'source_kind',
  'submitter_name',
];

function toRow(job) {
  const row = {};
  for (const col of WRITABLE_COLUMNS) {
    let value = job[col];
    if (col === 'vibe' || col === 'answers') value = JSON.stringify(value || {});
    row[col] = value === undefined ? null : value;
  }
  return row;
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

const SELECT_WITH_COMPANY = `
  SELECT j.*, c.name AS company_display_name, c.website AS company_website,
         c.sector AS company_sector, c.size_bucket AS company_size_bucket
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
`;

function hydrate(row) {
  if (!row) return null;
  const {
    company_display_name,
    company_website,
    company_sector,
    company_size_bucket,
    vibe,
    answers,
    languages,
    ...rest
  } = row;
  return {
    ...rest,
    vibe: parseJson(vibe),
    answers: parseJson(answers),
    languages: languages ? languages.split(',').filter(Boolean) : [],
    company: row.company_id
      ? {
          id: row.company_id,
          name: company_display_name,
          website: company_website,
          sector: company_sector,
          size_bucket: company_size_bucket,
        }
      : null,
  };
}

function createJob(job, { status = 'pending' } = {}) {
  const row = toRow(job);
  const cols = Object.keys(row);
  const info = db
    .prepare(
      `INSERT INTO jobs (${cols.join(', ')}, company_id, status)
       VALUES (${cols.map((c) => '@' + c).join(', ')}, @company_id, @status)`,
    )
    .run({ ...row, company_id: job.company_id || null, status });
  return info.lastInsertRowid;
}

function updateJob(id, job) {
  const row = toRow(job);
  const sets = Object.keys(row).map((c) => `${c} = @${c}`);
  const params = { ...row, id };
  if (job.company_id !== undefined) {
    sets.push('company_id = @company_id');
    params.company_id = job.company_id || null;
  }
  return db
    .prepare(`UPDATE jobs SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = @id`)
    .run(params).changes;
}

function getJob(id) {
  return hydrate(db.prepare(`${SELECT_WITH_COMPANY} WHERE j.id = ?`).get(id));
}

// Öffentliche Liste mit Filtern (AC-10 bis AC-13). Alle gesetzten Filter
// müssen gleichzeitig zutreffen.
function listJobs({
  status = 'approved',
  job_type,
  degree_level,
  semester,
  work_mode,
  paid,
  language,
  sector,
  location,
  salary_given,
  search,
} = {}) {
  let query = `${SELECT_WITH_COMPANY} WHERE j.status = @status`;
  const params = { status };

  if (job_type) {
    query += ' AND j.job_type = @job_type';
    params.job_type = job_type;
  }
  if (degree_level) {
    // "beides" und "egal" passen sowohl zu Bachelor als auch zu Master
    query += " AND j.degree_level IN (@degree_level, 'beides', 'egal')";
    params.degree_level = degree_level;
  }
  if (semester !== undefined && semester !== null && semester !== '') {
    query += ' AND (j.min_semester IS NULL OR j.min_semester <= @semester)';
    params.semester = Number(semester);
  }
  if (work_mode) {
    query += ' AND j.work_mode = @work_mode';
    params.work_mode = work_mode;
  }
  if (paid) {
    query += ' AND j.paid = @paid';
    params.paid = paid;
  }
  if (language) {
    // languages ist kommagetrennt ("de,en"); Kommas drumherum verhindern
    // Teiltreffer
    query += " AND instr(',' || j.languages || ',', ',' || @language || ',') > 0";
    params.language = String(language).toLowerCase();
  }
  if (sector) {
    query += ' AND c.sector = @sector';
    params.sector = sector;
  }
  if (location) {
    query += ' AND j.location LIKE @location';
    params.location = `%${location}%`;
  }
  if (salary_given === true || salary_given === '1' || salary_given === 1) {
    query += ' AND (j.salary_min IS NOT NULL OR j.salary_max IS NOT NULL)';
  }
  if (search) {
    query += ' AND (j.title LIKE @search OR j.description LIKE @search OR j.company_name LIKE @search)';
    params.search = `%${search}%`;
  }
  query += ' ORDER BY j.created_at DESC, j.id DESC';

  return db.prepare(query).all(params).map(hydrate);
}

// Freigeben setzt updated_at neu, damit eine lange in der Warteschlange
// liegende Stelle nicht direkt nach der Freigabe als veraltet abläuft.
function bulkUpdateStatus(ids, status) {
  const stmt = db.prepare("UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?");
  const run = db.transaction((idList) => {
    let affected = 0;
    for (const id of idList) affected += stmt.run(status, id).changes;
    return affected;
  });
  return run(ids);
}

function bulkDelete(ids) {
  const stmt = db.prepare('DELETE FROM jobs WHERE id = ?');
  const run = db.transaction((idList) => {
    let affected = 0;
    for (const id of idList) affected += stmt.run(id).changes;
    return affected;
  });
  return run(ids);
}

// Ablauf (AC-18, AC-19): Frist überschritten, oder ohne Frist seit
// maxAgeDays nicht mehr aktualisiert. today im Format JJJJ-MM-TT.
function expireJobs({ today = new Date().toISOString().slice(0, 10), maxAgeDays = 90 } = {}) {
  return db
    .prepare(
      `UPDATE jobs SET status = 'expired', updated_at = datetime('now')
       WHERE status = 'approved'
         AND (
           (deadline IS NOT NULL AND deadline < @today)
           OR (deadline IS NULL AND updated_at < datetime(@today, '-' || @maxAgeDays || ' days'))
         )`,
    )
    .run({ today, maxAgeDays: Number(maxAgeDays) }).changes;
}

module.exports = {
  createJob,
  updateJob,
  getJob,
  listJobs,
  bulkUpdateStatus,
  bulkDelete,
  expireJobs,
};
