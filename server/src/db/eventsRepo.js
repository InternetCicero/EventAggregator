const db = require('./index');
const { classifyPair } = require('./duplicates');

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

// "Auch bei": weitere Quellen, die dasselbe Event listen, und bei markierten
// Events der Verweis auf das ähnliche Event (für die Admin-Ansicht).
function attachListings(events) {
  const listingStmt = db.prepare(
    'SELECT source, url, title FROM event_listings WHERE event_id = ? ORDER BY id ASC',
  );
  const originalStmt = db.prepare('SELECT title, source FROM events WHERE id = ?');
  return events.map((e) => {
    const original = e.duplicate_of ? originalStmt.get(e.duplicate_of) : null;
    return {
      ...e,
      also_listed: listingStmt.all(e.id),
      duplicate_of_title: original ? original.title : null,
      duplicate_of_source: original ? original.source : null,
    };
  });
}

function createEvent(data) {
  const stmt = db.prepare(`
    INSERT INTO events (title, description, category, format, start_date, end_date, location, url, image_url, source, status, submitter_name, duplicate_of)
    VALUES (@title, @description, @category, @format, @start_date, @end_date, @location, @url, @image_url, @source, @status, @submitter_name, @duplicate_of)
  `);
  const info = stmt.run({
    title: data.title,
    description: data.description || null,
    category: data.category,
    format: data.format || null,
    start_date: data.start_date,
    end_date: data.end_date || null,
    location: data.location || null,
    url: data.url || null,
    image_url: data.image_url || null,
    source: data.source || 'manual',
    status: data.status || 'pending',
    submitter_name: data.submitter_name || null,
    duplicate_of: data.duplicate_of || null,
  });
  if (data.tags && data.tags.length) setEventTags(info.lastInsertRowid, data.tags);
  return info.lastInsertRowid;
}

function listEvents({ status = 'approved', category, format, tag, from, to, search, onlyDuplicates } = {}) {
  let query = 'SELECT * FROM events WHERE status = @status';
  const params = { status };

  if (category) {
    query += ' AND category = @category';
    params.category = category;
  }
  if (format) {
    query += ' AND format = @format';
    params.format = format;
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
  if (onlyDuplicates) query += ' AND duplicate_of IS NOT NULL';
  query += ' ORDER BY start_date ASC';

  let events = db.prepare(query).all(params);
  events = attachListings(attachTags(events));

  if (tag) {
    events = events.filter((e) => e.tags.includes(tag.toLowerCase()));
  }
  return events;
}

function getEvent(id) {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!event) return null;
  return attachListings(attachTags([event]))[0];
}

function updateEventStatus(id, status) {
  db.prepare("UPDATE events SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

function deleteEvent(id) {
  db.prepare('DELETE FROM events WHERE id = ?').run(id);
}

// Für die Mehrfachauswahl im Admin-Bereich: alle IDs in einer Transaktion
// statt vieler einzelner Requests. Gibt zurück, wie viele Zeilen tatsächlich
// getroffen wurden (IDs, die es nicht mehr gibt, werden stillschweigend
// übersprungen statt einen Fehler zu werfen).
function bulkUpdateStatus(ids, status) {
  const stmt = db.prepare("UPDATE events SET status = ?, updated_at = datetime('now') WHERE id = ?");
  const run = db.transaction((idList) => {
    let affected = 0;
    for (const id of idList) affected += stmt.run(status, id).changes;
    return affected;
  });
  return run(ids);
}

function bulkDelete(ids) {
  const stmt = db.prepare('DELETE FROM events WHERE id = ?');
  const run = db.transaction((idList) => {
    let affected = 0;
    for (const id of idList) affected += stmt.run(id).changes;
    return affected;
  });
  return run(ids);
}

function findDuplicateByUrl(url) {
  if (!url) return null;
  return db.prepare('SELECT id FROM events WHERE url = ?').get(url);
}

// Manche Quellen verlinken mehrere unterschiedliche Termine (z. B. dieselbe
// Roadshow in verschiedenen Städten) auf dieselbe Detailseite. Ein reiner
// URL-Abgleich würde dann alle bis auf den ersten Termin als Duplikat
// verwerfen. Zusätzlich zum Titel abzugleichen behebt das, ohne echte
// Duplikate (gleiche URL, gleicher Titel) durchzulassen.
function findDuplicateByUrlAndTitle(url, title) {
  if (!url) return null;
  return db.prepare('SELECT id FROM events WHERE url = ? AND title = ?').get(url, title);
}

// Für Quellen, deren Karten keinen eigenen Link haben (Details öffnen sich
// per JavaScript): ohne URL bleibt nur Titel + Startzeit als Merkmal.
function findDuplicateByTitleAndStart(title, startDate) {
  return db.prepare('SELECT id FROM events WHERE title = ? AND start_date = ?').get(title, startDate);
}

// Sucht unter den vorhandenen Events (jeder Status) das ähnlichste am selben
// Tag. Events derselben Quelle zählen nicht mit: mehrere Termine einer Quelle
// am selben Tag sind legitim, echte Wiederholungen fängt die URL-/Titel-
// Prüfung der Quelle ab. Ausnahme "manual": Einreichungen kommen von
// verschiedenen Personen, dort wird auch untereinander verglichen.
// Liefert { level: 'duplicate' | 'possible', similarity, event } oder null.
function findDuplicateCandidate({ title, start_date, location, source }) {
  const day = String(start_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const rows = db
    .prepare(
      `SELECT id, title, start_date, location, source, url, status FROM events
       WHERE substr(start_date, 1, 10) = ?
       ORDER BY id ASC`,
    )
    .all(day);

  let best = null;
  for (const row of rows) {
    if (row.source === source && source !== 'manual') continue;
    const hit = classifyPair({ title, start_date, location }, row);
    if (hit && (!best || hit.similarity > best.similarity)) best = { ...hit, event: row };
  }
  return best;
}

// Vermerkt eine weitere Quelle ("Auch bei") an einem vorhandenen Event.
// Die eigene Quelle des Events und bereits vermerkte Quellen werden
// ignoriert. Gibt true zurück, wenn ein neuer Eintrag angelegt wurde.
function addListing(eventId, { source, url, title }) {
  const event = db.prepare('SELECT source FROM events WHERE id = ?').get(eventId);
  if (!event || event.source === source) return false;
  const info = db
    .prepare('INSERT OR IGNORE INTO event_listings (event_id, source, url, title) VALUES (?, ?, ?, ?)')
    .run(eventId, source, url || null, title || null);
  return info.changes > 0;
}

// Entfernt die Duplikat-Markierung (Admin: "Kein Duplikat"). Status und
// "Auch bei"-Einträge bleiben unverändert. Gibt true zurück, wenn das Event
// markiert war.
function clearDuplicate(id) {
  return db.prepare('UPDATE events SET duplicate_of = NULL WHERE id = ? AND duplicate_of IS NOT NULL').run(id).changes > 0;
}

// Führt ein als Duplikat markiertes Event in sein Original zusammen: dessen
// Quelle (samt Link und Titel) und seine eigenen "Auch bei"-Einträge werden am
// Original vermerkt, das markierte Event wird abgelehnt (nicht gelöscht, damit
// die Prüfung über URL und Titel es beim nächsten Scraper-Lauf als bekannt
// erkennt). Alles in einer Transaktion.
// Liefert { ok: true, into } oder { error: <Code> }; Codes: not_found,
// not_marked, event_rejected, original_missing, original_rejected,
// original_not_approved.
function mergeEvent(id) {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!event) return { error: 'not_found' };
  if (!event.duplicate_of) return { error: 'not_marked' };
  if (event.status === 'rejected') return { error: 'event_rejected' };

  const original = db.prepare('SELECT id, title, source, status FROM events WHERE id = ?').get(event.duplicate_of);
  if (!original) {
    clearDuplicate(id);
    return { error: 'original_missing' };
  }
  if (original.status === 'rejected') return { error: 'original_rejected' };
  // Sonst würde das Event aus der öffentlichen Liste verschwinden, ohne dass
  // das Original sichtbar ist.
  if (event.status === 'approved' && original.status !== 'approved') return { error: 'original_not_approved' };

  const run = db.transaction(() => {
    addListing(original.id, { source: event.source, url: event.url, title: event.title });
    const own = db.prepare('SELECT source, url, title FROM event_listings WHERE event_id = ? ORDER BY id ASC').all(id);
    for (const listing of own) addListing(original.id, listing);
    db.prepare("UPDATE events SET status = 'rejected', updated_at = datetime('now') WHERE id = ?").run(id);
  });
  run();
  return { ok: true, into: { id: original.id, title: original.title, source: original.source } };
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
  findDuplicateByUrlAndTitle,
  findDuplicateByTitleAndStart,
  findDuplicateCandidate,
  addListing,
  clearDuplicate,
  mergeEvent,
  listAllTags,
  bulkUpdateStatus,
  bulkDelete,
};
