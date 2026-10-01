// Testet die einmalige Schema-Migration in db/index.js (Umstellung auf die
// neuen Kategorien + Format-Erkennung + Korrektur der Quellen-Standard-
// kategorie). Braucht eine eigene Datei statt ":memory:", weil die
// Alt-Daten VOR dem require von db/index.js existieren müssen (die
// Migration läuft beim Laden des Moduls) — ":memory:" entsteht aber erst
// durch genau dieses require und kann vorher nicht befüllt werden.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Database = require('better-sqlite3');

const tmpPath = path.join(os.tmpdir(), `migration-test-${Date.now()}-${process.pid}.db`);
process.env.EVENTS_DB_PATH = tmpPath;

// Alt-Schema (Stand vor der Kategorie-/Format-Umstellung) von Hand anlegen
// und mit Daten füllen, die genau die in der Praxis aufgetretenen Fälle
// abdecken, bevor db/index.js (und damit die Migration) geladen wird.
const seedDb = new Database(tmpPath);
seedDb.exec(`
  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
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
  CREATE TABLE sources (
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
    active INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    last_run_status TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
  CREATE TABLE event_tags (
    event_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (event_id, tag_id)
  );
`);

seedDb
  .prepare(
    `INSERT INTO sources (name, base_url, list_url, item_selector, title_selector, category)
     VALUES (@name, 'https://example.com', 'https://example.com', '.item', '.title', @category)`,
  )
  .run({ name: 'PwC Karriere-Events', category: 'Business & Networking' });

const insertEvent = seedDb.prepare(
  `INSERT INTO events (title, category, start_date, location, source)
   VALUES (@title, @category, '2026-10-01T18:00', @location, @source)`,
);
// Afterwork-Event, alte Kategorie "Business & Networking" -> sollte per
// Titel-Keyword als "Networking" erkannt werden, nicht nur über den Fallback.
insertEvent.run({
  title: 'Afterwork with HHL | Berlin',
  category: 'Business & Networking',
  location: 'Online Event',
  source: 'PwC Karriere-Events',
});
// Kein Titel-Keyword-Treffer -> fiel beim ersten Lauf (als die Quelle noch
// "Business & Networking" hieß) auf "Sonstiges" zurück.
insertEvent.run({
  title: 'Schulpraktikum - Tax Kickstart (m/w/d)',
  category: 'Sonstiges',
  location: 'Frankfurt',
  source: 'PwC Karriere-Events',
});
// Manuell eingereichtes Event ohne passende Quelle -> darf vom gezielten
// "Sonstiges"-Nachlauf (Version 4) nicht angefasst werden.
insertEvent.run({
  title: 'Privates Grillfest',
  category: 'Sonstiges',
  location: null,
  source: 'manual',
});
seedDb.close();

// Erst jetzt laden — db/index.js öffnet dieselbe Datei und migriert sie beim
// Require-Zeitpunkt.
const db = require('../src/db/index');

test('Migration: Kategorie wird per Titel-Keyword erkannt (Vorrang vor Quellen-Fallback)', () => {
  const row = db.prepare("SELECT category, format FROM events WHERE title LIKE 'Afterwork%'").get();
  assert.equal(row.category, 'Networking');
  assert.equal(row.format, 'online');
});

test('Migration: "Sonstiges"-Events werden anhand der (korrigierten) Quellen-Kategorie nachsortiert', () => {
  const row = db.prepare("SELECT category FROM events WHERE title LIKE 'Schulpraktikum%'").get();
  assert.equal(row.category, 'Consulting');
});

test('Migration: manuell eingereichte "Sonstiges"-Events ohne zugehörige Quelle bleiben unverändert', () => {
  const row = db.prepare("SELECT category FROM events WHERE title = 'Privates Grillfest'").get();
  assert.equal(row.category, 'Sonstiges');
});

test('Migration: Quellen-Standardkategorie wird auf die neue Taxonomie gehoben', () => {
  const row = db.prepare("SELECT category FROM sources WHERE name = 'PwC Karriere-Events'").get();
  assert.equal(row.category, 'Consulting');
});

test('Migration: schema_version steht danach auf dem aktuellen Stand', () => {
  const { user_version } = db.prepare('PRAGMA user_version').get();
  assert.ok(user_version >= 4);
});

test.after(() => {
  db.close();
  fs.rmSync(tmpPath, { force: true });
  fs.rmSync(`${tmpPath}-wal`, { force: true });
  fs.rmSync(`${tmpPath}-shm`, { force: true });
});
