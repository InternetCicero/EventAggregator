const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Tests setzen EVENTS_DB_PATH auf eine temporäre Datei (z.B. ":memory:"),
// damit sie nicht die echte data/events.db anfassen. Ohne die Variable
// verhält sich das Modul wie bisher.
const dbPath = process.env.EVENTS_DB_PATH || path.join(__dirname, '..', '..', 'data', 'events.db');
if (dbPath !== ':memory:') {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  format TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  location TEXT,
  url TEXT,
  image_url TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  submitter_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS event_tags (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, tag_id)
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  list_url TEXT NOT NULL,
  item_selector TEXT NOT NULL,
  title_selector TEXT NOT NULL,
  date_selector TEXT,
  location_selector TEXT,
  link_selector TEXT,
  link_attr TEXT DEFAULT 'href',
  description_selector TEXT,
  category TEXT NOT NULL DEFAULT 'Sonstiges',
  default_tags TEXT DEFAULT '',
  render_js INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_run_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
`);

const sourceColumns = db.prepare("PRAGMA table_info(sources)").all().map((c) => c.name);
if (!sourceColumns.includes('render_js')) {
  db.exec('ALTER TABLE sources ADD COLUMN render_js INTEGER NOT NULL DEFAULT 0');
}

const eventColumns = db.prepare('PRAGMA table_info(events)').all().map((c) => c.name);
if (!eventColumns.includes('format')) {
  db.exec('ALTER TABLE events ADD COLUMN format TEXT');
}

// Einmalige Migration (PRAGMA user_version als simpler Versionszähler, kein
// extra Tabelle nötig): die Kategorie-Liste wurde von generischen
// Event-Kategorien auf eine Business-/Karriere-fokussierte Taxonomie
// umgestellt (siehe categories.js), und das neue "format"-Feld
// (online/vor Ort) wird für bestehende Events nachträglich befüllt.
// Läuft bewusst nur einmal, damit spätere manuelle Korrekturen im
// Admin-Bereich bei einem Neustart nicht wieder überschrieben werden.
const CURRENT_SCHEMA_VERSION = 2;
const { user_version: schemaVersion } = db.prepare('PRAGMA user_version').get();

if (schemaVersion < CURRENT_SCHEMA_VERSION) {
  const { classifyCategory, inferFormat } = require('../scraper/classify');

  // Alte Kategorie -> bester Startpunkt im neuen System, falls keine
  // Titel-Schlüsselwörter (classifyCategory) eine treffendere Kategorie
  // finden. Bereits gültige neue Namen bilden auf sich selbst ab.
  const OLD_TO_NEW_FALLBACK = {
    'Business & Networking': 'Sonstiges',
    Workshop: 'Workshop & Case Study',
    Musik: 'Sonstiges',
    Kultur: 'Sonstiges',
    Sport: 'Sonstiges',
    Markt: 'Sonstiges',
    'Party & Nachtleben': 'Sonstiges',
    'Familie & Kinder': 'Sonstiges',
    'Essen & Trinken': 'Sonstiges',
    'Kunst & Ausstellung': 'Sonstiges',
  };

  const rows = db.prepare('SELECT id, title, category, location, format FROM events').all();
  const updateStmt = db.prepare('UPDATE events SET category = ?, format = ? WHERE id = ?');
  const migrate = db.transaction(() => {
    for (const row of rows) {
      const fallback = OLD_TO_NEW_FALLBACK[row.category] || row.category;
      const category = classifyCategory(row.title, fallback);
      const format = row.format || inferFormat(row.location);
      if (category !== row.category || format !== row.format) {
        updateStmt.run(category, format, row.id);
      }
    }
  });
  migrate();

  db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
}

module.exports = db;
