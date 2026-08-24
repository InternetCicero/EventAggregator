const db = require('./index');

function createSource(data) {
  const stmt = db.prepare(`
    INSERT INTO sources (
      name, base_url, list_url, item_selector, title_selector, date_selector,
      location_selector, link_selector, link_attr, description_selector,
      category, default_tags, active
    ) VALUES (
      @name, @base_url, @list_url, @item_selector, @title_selector, @date_selector,
      @location_selector, @link_selector, @link_attr, @description_selector,
      @category, @default_tags, @active
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

function updateSource(id, data) {
  const fields = [
    'name', 'base_url', 'list_url', 'item_selector', 'title_selector', 'date_selector',
    'location_selector', 'link_selector', 'link_attr', 'description_selector',
    'category', 'default_tags', 'active',
  ];
  const sets = fields.filter((f) => data[f] !== undefined).map((f) => `${f} = @${f}`);
  if (!sets.length) return;
  const stmt = db.prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = @id`);
  stmt.run({ id, ...data });
}

function deleteSource(id) {
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
}

function markRun(id, status) {
  db.prepare("UPDATE sources SET last_run_at = datetime('now'), last_run_status = ? WHERE id = ?").run(status, id);
}

module.exports = { createSource, listSources, getSource, updateSource, deleteSource, markRun };
