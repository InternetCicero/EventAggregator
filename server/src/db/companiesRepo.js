const db = require('./index');
const sectors = require('./sectors');

const SIZE_BUCKETS = ['1-50', '51-250', '251-1000', '1000+'];

function normalize(data) {
  const name = String(data.name || '').trim();
  const sector = data.sector || null;
  const size_bucket = data.size_bucket || null;
  const errors = [];
  if (!name) errors.push('Name fehlt');
  if (sector && !sectors.includes(sector)) errors.push('Ungültige Branche');
  if (size_bucket && !SIZE_BUCKETS.includes(size_bucket)) errors.push('Ungültige Größe');
  return {
    errors,
    company: { name, website: String(data.website || '').trim() || null, sector, size_bucket },
  };
}

function listCompanies() {
  return db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id) AS job_count
       FROM companies c ORDER BY c.name COLLATE NOCASE ASC`,
    )
    .all();
}

function getCompany(id) {
  return db.prepare('SELECT * FROM companies WHERE id = ?').get(id) || null;
}

function findByName(name) {
  return db.prepare('SELECT * FROM companies WHERE name = ? COLLATE NOCASE').get(String(name).trim()) || null;
}

function createCompany(company) {
  return db
    .prepare('INSERT INTO companies (name, website, sector, size_bucket) VALUES (@name, @website, @sector, @size_bucket)')
    .run(company).lastInsertRowid;
}

function updateCompany(id, company) {
  return db
    .prepare(
      'UPDATE companies SET name = @name, website = @website, sector = @sector, size_bucket = @size_bucket WHERE id = @id',
    )
    .run({ ...company, id }).changes;
}

function deleteCompany(id) {
  return db.prepare('DELETE FROM companies WHERE id = ?').run(id).changes;
}

module.exports = {
  SIZE_BUCKETS,
  normalize,
  listCompanies,
  getCompany,
  findByName,
  createCompany,
  updateCompany,
  deleteCompany,
};
