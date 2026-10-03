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
const CURRENT_SCHEMA_VERSION = 5;
const { user_version: schemaVersion } = db.prepare('PRAGMA user_version').get();

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

if (schemaVersion < 2) {
  const { classifyCategory, inferFormat } = require('../scraper/classify');

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
}

if (schemaVersion < 3) {
  // Schritt 1 (Version 2) hat nur bestehende EVENTS neu einsortiert. Die
  // Standard-Kategorie der QUELLEN selbst (der Fallback für künftig neu
  // gescrapte Events ohne Stichwort-Treffer im Titel) blieb dabei auf dem
  // alten, inzwischen ungültigen Namen stehen (z.B. "Business & Networking"
  // bei PwC/SQUEAKER). Bekannte Quellen bekommen hier eine passende Branche,
  // alle anderen werden best möglich auf die neue Liste abgebildet.
  const validCategories = require('./categories');
  const SOURCE_NAME_OVERRIDES = {
    'HHL Leipzig Veranstaltungen': 'Bildung & Vortrag',
    'Hackathon Hub Europe': 'Workshop & Case Study',
    'PwC Karriere-Events': 'Consulting',
    'SQUEAKER Karriere-Events': 'Consulting',
    'Deloitte Recruiting-Events': 'Consulting',
    'Strategy& (PwC) Karriere-Events': 'Consulting',
    'Roland Berger Events': 'Consulting',
    // e-fellows.net listet Events aus allen Branchen (Consulting, Banking,
    // Start-ups, Hackathons, Stipendien) in einem Feed — "Sonstiges" als
    // Fallback, die Stichwort-Klassifizierung sortiert die meisten Titel
    // beim nächsten Scrape-Lauf ohnehin automatisch treffender ein.
    'e-fellows.net Events': 'Sonstiges',
  };

  const sources = db.prepare('SELECT id, name, category FROM sources').all();
  const updateSourceStmt = db.prepare('UPDATE sources SET category = ? WHERE id = ?');
  const migrateSources = db.transaction(() => {
    for (const source of sources) {
      const category =
        SOURCE_NAME_OVERRIDES[source.name] ||
        OLD_TO_NEW_FALLBACK[source.category] ||
        (validCategories.includes(source.category) ? source.category : 'Sonstiges');
      if (category !== source.category) {
        updateSourceStmt.run(category, source.id);
      }
    }
  });
  migrateSources();
}

if (schemaVersion < 4) {
  // Events, die zwischen der alten Kategorie-Umstellung (Version 2, pro
  // Event) und der Korrektur der Quellen-Standardkategorie (Version 3)
  // gescraped wurden, landeten mit dem damaligen Fallback "Sonstiges" in
  // der DB, obwohl ihre Quelle inzwischen eine treffendere Branche hat
  // (z.B. "Consulting" bei PwC). Gezielter Nachlauf nur für "Sonstiges"
  // -Events mit bekannter Quelle — absichtlich manuell gesetzte "Sonstiges"
  // -Events (z.B. über das Einreichungsformular, source='manual') bleiben
  // unberührt, weil es dafür keinen passenden Quellen-Eintrag gibt.
  const { classifyCategory } = require('../scraper/classify');

  const rows = db
    .prepare(
      `SELECT e.id, e.title, e.category, s.category AS source_category
       FROM events e
       JOIN sources s ON s.name = e.source
       WHERE e.category = 'Sonstiges'`,
    )
    .all();
  const updateStmt = db.prepare('UPDATE events SET category = ? WHERE id = ?');
  const reclassify = db.transaction(() => {
    for (const row of rows) {
      const category = classifyCategory(row.title, row.source_category);
      if (category !== row.category) updateStmt.run(category, row.id);
    }
  });
  reclassify();
}

if (schemaVersion < 5) {
  // "Hackathon" ist jetzt eine eigene Kategorie (vorher Teil von "Workshop &
  // Case Study"). Die Hackathon-Hub-Quelle bekommt sie als Standard, und
  // bestehende Events, die bisher unter "Workshop & Case Study" liefen,
  // werden einmalig neu eingeordnet: Titel mit Hackathon-Stichwort gehen per
  // classifyCategory dorthin, Events der Hackathon-Quelle ohne Stichwort
  // (z.B. "Student Competition 2026") über den Quellen-Fallback. Alle
  // anderen "Workshop & Case Study"-Events (z.B. Case-Interview-Workshops
  // von SQUEAKER) behalten ihre Kategorie, ebenso manuell zugeordnete
  // Events in anderen Kategorien.
  const { classifyCategory } = require('../scraper/classify');

  const migrate = db.transaction(() => {
    db.prepare(
      "UPDATE sources SET category = 'Hackathon' WHERE name = 'Hackathon Hub Europe' OR list_url LIKE '%hackathonhub.eu%'",
    ).run();

    const rows = db
      .prepare(
        `SELECT e.id, e.title, e.category, s.category AS source_category
         FROM events e
         LEFT JOIN sources s ON s.name = e.source
         WHERE e.category = 'Workshop & Case Study'`,
      )
      .all();
    const updateStmt = db.prepare('UPDATE events SET category = ? WHERE id = ?');
    for (const row of rows) {
      const fallback = row.source_category === 'Hackathon' ? 'Hackathon' : row.category;
      const category = classifyCategory(row.title, fallback);
      if (category !== row.category) updateStmt.run(category, row.id);
    }
  });
  migrate();
}

if (schemaVersion < CURRENT_SCHEMA_VERSION) {
  db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
}

module.exports = db;
