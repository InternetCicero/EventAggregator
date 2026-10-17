const db = require('./index');

// Obergrenze schützt die kleine VM (1 GB RAM): jede Seite ist ein Klick im
// Headless-Browser. Ungültige/fehlende Werte bedeuten "nur die erste Seite".
const MAX_PAGES_LIMIT = 50;
function normalizeMaxPages(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGES_LIMIT);
}

function createSource(data) {
  const stmt = db.prepare(`
    INSERT INTO sources (
      name, base_url, list_url, item_selector, title_selector, date_selector,
      location_selector, link_selector, link_attr, description_selector,
      category, default_tags, render_js, next_selector, max_pages, active
    ) VALUES (
      @name, @base_url, @list_url, @item_selector, @title_selector, @date_selector,
      @location_selector, @link_selector, @link_attr, @description_selector,
      @category, @default_tags, @render_js, @next_selector, @max_pages, @active
    )
  `);
  const info = stmt.run({
    name: data.name,
    base_url: data.base_url,
    list_url: data.list_url,
    item_selector: data.item_selector,
    title_selector: data.title_selector,
    date_selector: data.date_selector || null,
    location_selector: data.location_selector || null,
    link_selector: data.link_selector || null,
    link_attr: data.link_attr || 'href',
    description_selector: data.description_selector || null,
    category: data.category || 'Sonstiges',
    default_tags: data.default_tags || '',
    render_js: data.render_js ? 1 : 0,
    next_selector: data.next_selector || null,
    max_pages: normalizeMaxPages(data.max_pages),
    active: data.active === false ? 0 : 1,
  });
  return info.lastInsertRowid;
}

function listSources() {
  return db.prepare('SELECT * FROM sources ORDER BY id DESC').all();
}

function getSource(id) {
  return db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
}

// Formularwerte für SQLite aufbereiten: Booleans (Häkchen) lassen sich nicht
// binden, leere optionale Felder werden zu NULL, max_pages wird begrenzt.
const OPTIONAL_TEXT_FIELDS = [
  'date_selector', 'location_selector', 'link_selector', 'description_selector', 'next_selector',
];

function toSqlValue(field, value) {
  if (field === 'render_js' || field === 'active') return value ? 1 : 0;
  if (field === 'max_pages') return normalizeMaxPages(value);
  if (OPTIONAL_TEXT_FIELDS.includes(field)) return value || null;
  return value;
}

function updateSource(id, data) {
  const fields = [
    'name', 'base_url', 'list_url', 'item_selector', 'title_selector', 'date_selector',
    'location_selector', 'link_selector', 'link_attr', 'description_selector',
    'category', 'default_tags', 'render_js', 'next_selector', 'max_pages', 'active',
  ].filter((f) => data[f] !== undefined);
  if (!fields.length) return;
  const params = { id };
  for (const f of fields) params[f] = toSqlValue(f, data[f]);
  const sets = fields.map((f) => `${f} = @${f}`);
  db.prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = @id`).run(params);
}

function deleteSource(id) {
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
}

function markRun(id, status) {
  db.prepare("UPDATE sources SET last_run_at = datetime('now'), last_run_status = ? WHERE id = ?").run(status, id);
}

module.exports = { normalizeMaxPages, MAX_PAGES_LIMIT, createSource, listSources, getSource, updateSource, deleteSource, markRun };
