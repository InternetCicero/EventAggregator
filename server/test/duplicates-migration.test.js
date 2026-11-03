// AC-10: Die Migration auf Schema 6 markiert vorhandene Duplikat-Kandidaten,
// ohne etwas zu löschen oder zu verändern. Wie in migration.test.js braucht das
// eine Alt-Datenbank, die vor dem Laden von db/index.js existiert.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Database = require('better-sqlite3');

const tmpPath = path.join(os.tmpdir(), `dup-migration-test-${Date.now()}-${process.pid}.db`);
process.env.EVENTS_DB_PATH = tmpPath;

const seed = new Database(tmpPath);
seed.exec(`
  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, description TEXT, category TEXT NOT NULL, format TEXT,
    start_date TEXT NOT NULL, end_date TEXT, location TEXT, url TEXT, image_url TEXT,
    source TEXT NOT NULL DEFAULT 'manual', status TEXT NOT NULL DEFAULT 'pending',
    submitter_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
  CREATE TABLE event_tags (event_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (event_id, tag_id));
`);
seed.pragma('user_version = 5');
const insert = seed.prepare(
  `INSERT INTO events (title, category, start_date, location, source, status)
   VALUES (@title, 'Sonstiges', @start_date, @location, @source, @status)`,
);
const add = (title, start_date, location, source, status = 'approved') =>
  insert.run({ title, start_date, location, source, status }).lastInsertRowid;

const mckinsey = add('Karrieremesse Konstanz 2026', '2026-11-12T10:00', 'Konstanz', 'McKinsey', 'approved');
const efellows = add('Karrieremesse Konstanz', '2026-11-12T09:00', 'Konstanz', 'e-fellows', 'pending');
const otherDay = add('Karrieremesse Konstanz', '2026-11-13T10:00', 'Konstanz', 'BCG', 'pending');
const otherPlace = add('Karrieremesse Konstanz', '2026-11-12T10:00', 'Freiburg', 'BCG', 'pending');
const sameSource = add('Karrieremesse Konstanz', '2026-11-12T15:00', 'Konstanz', 'McKinsey', 'pending');
const rejected = add('Karrieremesse Konstanz Special', '2026-11-12T10:00', 'Konstanz', 'KPMG', 'rejected');
const unrelated = add('Etwas ganz anderes', '2026-11-12T10:00', 'Konstanz', 'PwC', 'approved');
seed.close();

const db = require('../src/db/index');
const row = (id) => db.prepare('SELECT * FROM events WHERE id = ?').get(id);

test('AC-10: spätere Duplikat-Kandidaten verweisen auf das früher angelegte Event', () => {
  assert.equal(row(mckinsey).duplicate_of, null);
  assert.equal(row(efellows).duplicate_of, mckinsey);
  assert.equal(row(rejected).duplicate_of, mckinsey);
});

test('AC-10: anderer Tag, anderer Ort und fremde Titel bleiben unmarkiert', () => {
  assert.equal(row(otherDay).duplicate_of, null);
  assert.equal(row(otherPlace).duplicate_of, null);
  assert.equal(row(unrelated).duplicate_of, null);
});

test('AC-10: Events derselben Quelle werden nicht miteinander verglichen (nur mit anderen Quellen)', () => {
  // Der zweite McKinsey-Termin am selben Tag verweist nicht auf den ersten
  // McKinsey-Termin, sondern auf den passenden Eintrag einer anderen Quelle.
  assert.notEqual(row(sameSource).duplicate_of, mckinsey);
  assert.equal(row(sameSource).duplicate_of, efellows);
});

test('AC-10: nichts wird gelöscht, abgelehnt oder inhaltlich verändert', () => {
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n, 7);
  assert.equal(row(efellows).status, 'pending');
  assert.equal(row(mckinsey).status, 'approved');
  assert.equal(row(rejected).status, 'rejected');
  assert.equal(row(efellows).title, 'Karrieremesse Konstanz');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_listings').get().n, 0);
});

test('Schema steht auf Version 6 und die Migration läuft nur einmal', () => {
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 6);
});

test.after(() => {
  db.close();
  fs.rmSync(tmpPath, { force: true });
  fs.rmSync(`${tmpPath}-wal`, { force: true });
  fs.rmSync(`${tmpPath}-shm`, { force: true });
});
