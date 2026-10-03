// runSource.js zieht transitiv db/index.js nach sich (eventsRepo/sourcesRepo).
// Isolierte In-Memory-DB verhindert, dass parallel laufende Testdateien sich
// beim Schema-Setup die echte data/events.db streitig machen.
process.env.EVENTS_DB_PATH = ':memory:';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyEvent, resolveUrl } = require('../src/scraper/runSource');
const { classifyCategory, inferFormat } = require('../src/scraper/classify');

test('classifyCategory: Hackathon (Hackathon, Buildathon, Hacklab, Hack Night)', () => {
  assert.equal(classifyCategory('TNG MuniHac Haskell Hackathon', 'Sonstiges'), 'Hackathon');
  assert.equal(classifyCategory('Tenzo\'s AI Buildathon', 'Sonstiges'), 'Hackathon');
  assert.equal(classifyCategory('Da Vinci Hacklab', 'Sonstiges'), 'Hackathon');
  assert.equal(classifyCategory('Hack Night', 'Sonstiges'), 'Hackathon');
  assert.equal(classifyCategory('Daytona & Give(a)Go HackSprint - Dublin', 'Sonstiges'), 'Hackathon');
});

test('classifyCategory: reines "Sprint" im Titel löst keine Workshop-Zuordnung aus (Quellen-Fallback gilt)', () => {
  assert.equal(classifyCategory('MediaTech SPRINT - Innovation and Collaboration', 'Hackathon'), 'Hackathon');
});

test('classifyCategory: Hackathon hat Vorrang vor Workshop/Networking im selben Titel', () => {
  assert.equal(classifyCategory('Hackathon Workshop & Afterwork', 'Sonstiges'), 'Hackathon');
});

test('classifyCategory: Workshop & Case Study (Case Interview, Workshop, Bootcamp)', () => {
  assert.equal(classifyCategory('Crack the Case - Women\'s Edition', 'Sonstiges'), 'Workshop & Case Study');
  assert.equal(classifyCategory('Seminar Verhandlungsführung Workshop', 'Sonstiges'), 'Workshop & Case Study');
  assert.equal(
    classifyCategory('SQUEAKER x Carma | Case Interview Structuring Masterclass', 'Consulting'),
    'Workshop & Case Study',
  );
});

test('classifyCategory: Networking (Afterwork, Meetup, Mixer, Netzwerkabend)', () => {
  assert.equal(classifyCategory('Afterwork with HHL | Berlin', 'Sonstiges'), 'Networking');
  assert.equal(classifyCategory('Tech Meetup München', 'Sonstiges'), 'Networking');
  assert.equal(classifyCategory('Netzwerkabend für Gründer:innen', 'Sonstiges'), 'Networking');
  assert.equal(classifyCategory('Investor Mixer', 'Sonstiges'), 'Networking');
});

test('classifyCategory: Start-up & Venture Capital', () => {
  assert.equal(classifyCategory('HHL SpinLab Investors Day', 'Sonstiges'), 'Start-up & Venture Capital');
  assert.equal(classifyCategory('Startup Pitch Night', 'Sonstiges'), 'Start-up & Venture Capital');
});

test('classifyCategory: Banking & Finance', () => {
  assert.equal(classifyCategory('Last Call Steuerberaterexamen 2026', 'Sonstiges'), 'Banking & Finance');
  assert.equal(classifyCategory('Banking, Finance & Insurance Online', 'Sonstiges'), 'Banking & Finance');
});

test('classifyCategory: Messen & Karrieretage (auch im Plural)', () => {
  assert.equal(classifyCategory('bonding Firmenkontaktmesse Aachen', 'Sonstiges'), 'Messen & Karrieretage');
  assert.equal(classifyCategory('Frankfurt School Career Days 2026', 'Sonstiges'), 'Messen & Karrieretage');
  assert.equal(classifyCategory('Career Fair ESADE 2026', 'Sonstiges'), 'Messen & Karrieretage');
});

test('classifyCategory: Consulting (Firmenname oder Schlagwort im Titel)', () => {
  assert.equal(classifyCategory('HSG Consulting Days', 'Sonstiges'), 'Consulting');
  assert.equal(classifyCategory('Deloitte Consulting Careers Day', 'Sonstiges'), 'Consulting');
});

test('classifyCategory: kein Treffer -> Standard-Kategorie der Quelle bleibt erhalten', () => {
  assert.equal(classifyCategory('Leipzig Leadership Lecture mit Christian Lindner', 'Bildung & Vortrag'), 'Bildung & Vortrag');
});

test('classifyCategory: Workshop-Regel hat Vorrang vor Networking (z.B. "Cocktailworkshop")', () => {
  assert.equal(classifyCategory('Roland Berger Cocktailworkshop KUL', 'Sonstiges'), 'Workshop & Case Study');
});

test('classifyEvent: vergibt bei Networking-Kategorie zusätzlich den Tag "networking"', () => {
  const result = classifyEvent('Afterwork with HHL | Berlin', 'Bildung & Vortrag', ['hhl']);
  assert.equal(result.category, 'Networking');
  assert.deepEqual(result.tags, ['hhl', 'networking']);
});

test('classifyEvent: vergibt den Tag nicht doppelt, wenn er schon gesetzt ist', () => {
  const result = classifyEvent('Afterwork with HHL', 'Sonstiges', ['networking']);
  assert.deepEqual(result.tags, ['networking']);
});

test('classifyEvent: ohne Treffer bleiben Kategorie und Tags unverändert', () => {
  const tags = ['hhl', 'studium'];
  const result = classifyEvent('Leipzig Leadership Lecture mit Christian Lindner', 'Bildung & Vortrag', tags);
  assert.equal(result.category, 'Bildung & Vortrag');
  assert.equal(result.tags, tags);
});

test('inferFormat: erkennt Online-Formate am Ort-Text', () => {
  assert.equal(inferFormat('Online Event'), 'online');
  assert.equal(inferFormat('online via Zoom'), 'online');
  assert.equal(inferFormat('Virtuelles Event'), 'online');
});

test('inferFormat: alles andere mit Ort-Angabe gilt als vor Ort', () => {
  assert.equal(inferFormat('Frankfurt am Main'), 'onsite');
  assert.equal(inferFormat('München'), 'onsite');
});

test('inferFormat: ohne Ort-Angabe unbekannt (null)', () => {
  assert.equal(inferFormat(null), null);
  assert.equal(inferFormat(''), null);
});

test('resolveUrl: löst relative Links gegen die Basis-URL auf', () => {
  assert.equal(resolveUrl('https://example.com', '/events/1'), 'https://example.com/events/1');
  assert.equal(resolveUrl('https://example.com/sub/', '../events/1'), 'https://example.com/events/1');
});

test('resolveUrl: lässt absolute Links unverändert', () => {
  assert.equal(resolveUrl('https://example.com', 'https://other.com/x'), 'https://other.com/x');
});

test('resolveUrl: liefert null bei fehlendem oder kaputtem Link', () => {
  assert.equal(resolveUrl('https://example.com', null), null);
  assert.equal(resolveUrl('nicht-mal-eine-url', 'auch-nicht'), null);
});
