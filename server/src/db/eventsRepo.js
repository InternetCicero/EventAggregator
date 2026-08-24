const db = require('./index');

function getOrCreateTagIds(tagNames) {
  const insert = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const select = db.prepare('SELECT id FROM tags WHERE name = ?');
  const ids = [];
  for (const raw of tagNames) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    insert.run(name);
    const row = select.get(name);
    ids.push(row.id);
  }
  return ids;
}

function setEventTags(eventId, tagNames) {
  db.prepare('DELETE FROM event_tags WHERE event_id = ?').run(eventId);
  const ids = getOrCreateTagIds(tagNames || []);
  const insert = db.prepare('INSERT OR IGNORE INTO event_tags (event_id, tag_id) VALUES (?, ?)');
  for (const tagId of ids) insert.run(eventId, tagId);
}

function attachTags(events) {
  const tagStmt = db.prepare(`
    SELECT t.name FROM tags t
    JOIN event_tags et ON et.tag_id = t.id
    WHERE et.event_id = ?
  `);
  return events.map((e) => ({
    ...e,
    tags: tagStmt.all(e.id).map((r) => r.name),
  }));
}

function createEvent(data) {
  const stmt = db.prepare(`
    INSERT INTO events (title, description, category, start_date, end_date, location, url, image_url, source, status, submitter_name)
    VALUES (@title, @description, @category, @start_date, @end_date, @location, @url, @image_url, @source, @status, @submitter_name)
  `);
  const info = stmt.run({
    title: data.title,
    description: data.description || null,
    category: data.category,
    start_date: data.start_date,
    end_date: data.end_date || null,
    location: data.location || null,
    url: data.url || null,
    image_url: data.image_url || null,
    source: data.source || 'manual',
    status: data.status || 'pending',
    submitter_name: data.submitter_name || null,
  });
  if (data.tags && data.tags.length) setEventTags(info.lastInsertRowid, data.tags);
  return info.lastInsertRowid;
}

function listEvents({ status = 'approved', category, tag, from, to, search } = {}) {
  let query = 'SELECT * FROM events WHERE status = @status';
  const params = { status };

  if (category) {
    query += ' AND category = @category';
    params.category = category;
  }
  if (from) {
    query += ' AND (end_date IS NULL AND start_date >= @from OR end_date >= @from)';
    params.from = from;
  }
  if (to) {
    query += ' AND start_date <= @to';
    params.to = to;
  }
  if (search) {
    query += ' AND (title LIKE @search OR description LIKE @search OR location LIKE @search)';
    params.search = `%${search}%`;
  }
  query += ' ORDER BY start_date ASC';

  let events = db.prepare(query).all(params);
  events = attachTags(events);

  if (tag) {
    events = events.filter((e) => e.tags.includes(tag.toLowerCase()));
  }
  return events;
}

function getEvent(id) {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!event) return null;
  return attachTags([event])[0];
}

function updateEventStatus(id, status) {
  db.prepare("UPDATE events SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

function deleteEvent(id) {
  db.prepare('DELETE FROM events WHERE id = ?').run(id);
}

function findDuplicateByUrl(url) {
  if (!url) return null;
  return db.prepare('SELECT id FROM events WHERE url = ?').get(url);
}

function listAllTags() {
  return db.prepare('SELECT name FROM tags ORDER BY name ASC').all().map((r) => r.name);
}

module.exports = {
  createEvent,
  listEvents,
  getEvent,
  updateEventStatus,
  deleteEvent,
  setEventTags,
  findDuplicateByUrl,
  listAllTags,
};
