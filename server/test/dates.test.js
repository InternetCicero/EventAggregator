// runSource.js zieht transitiv db/index.js nach sich (eventsRepo/sourcesRepo).
// Isolierte In-Memory-DB verhindert, dass parallel laufende Testdateien sich
// beim Schema-Setup die echte data/events.db streitig machen.
process.env.EVENTS_DB_PATH = ':memory:';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseDateGuess, extractTrailingLocation } = require('../src/scraper/runSource');

test('parseDateGuess: ISO-Datum', () => {
  assert.equal(parseDateGuess('2026-09-24'), '2026-09-24T00:00');
  assert.equal(parseDateGuess('2026-09-24T18:30'), '2026-09-24T18:30');
});

test('parseDateGuess: deutsches numerisches Format TT.MM.JJJJ', () => {
  assert.equal(parseDateGuess('24.09.2026'), '2026-09-24T00:00');
  assert.equal(parseDateGuess('5.3.26'), '2026-03-05T00:00');
});

test('parseDateGuess: deutscher Monatsname mit Jahr', () => {
  assert.equal(parseDateGuess('24. September 2026'), '2026-09-24T00:00');
  assert.equal(parseDateGuess('29 August 2026'), '2026-08-29T00:00');
});

test('parseDateGuess: deutscher Monatsname mit Komma vor dem Jahr (Phenom-People-Widgets)', () => {
  assert.equal(parseDateGuess('Dienstag, 20. Oktober, 2026'), '2026-10-20T00:00');
  assert.equal(
    parseDateGuess('Donnerstag, 5. November, 2026 - Freitag, 6. November, 2026'),
    '2026-11-05T00:00',
  );
});

test('parseDateGuess: englisches Format "Mon DD, YYYY"', () => {
  assert.equal(parseDateGuess('Aug 24, 2026'), '2026-08-24T00:00');
});

// Die Tag+Monat-ohne-Jahr-Logik hängt vom aktuellen Datum ab (Jahr wird
// geraten, mit Rollover bei vergangenen Daten). Damit die Tests nicht vom
// Kalendertag abhängen, an dem sie laufen, wird ein fester Referenzzeitpunkt
// ("heute" = 15. Juni 2026) injiziert statt der echten Systemzeit.
const REFERENCE_NOW = new Date('2026-06-15T12:00:00');

test('parseDateGuess: Tag + Monat ohne Jahr, Datum liegt noch in der Zukunft -> laufendes Jahr', () => {
  const result = parseDateGuess('20 Juni', REFERENCE_NOW);
  assert.equal(result, '2026-06-20T00:00');
});

test('parseDateGuess: Tag + Monat ohne Jahr, Datum liegt > 3 Tage zurück -> nächstes Jahr', () => {
  const result = parseDateGuess('1 Januar', REFERENCE_NOW);
  assert.equal(result, '2027-01-01T00:00');
});

test('parseDateGuess: Tag + Monat ohne Jahr, Datum liegt innerhalb der 3-Tage-Toleranz -> kein Rollover', () => {
  const result = parseDateGuess('13 Juni', REFERENCE_NOW); // 2 Tage vor REFERENCE_NOW
  assert.equal(result, '2026-06-13T00:00');
});

test('parseDateGuess: Tag + Monat aus einem Datumsbereich ("20 Okt - 21 Okt") nimmt den ersten Treffer', () => {
  const result = parseDateGuess('20 Okt - 21 Okt', REFERENCE_NOW);
  assert.equal(result, '2026-10-20T00:00');
});

test('parseDateGuess: unverständlicher Text liefert null', () => {
  assert.equal(parseDateGuess('Jederzeit buchbar'), null);
  assert.equal(parseDateGuess(''), null);
  assert.equal(parseDateGuess(null), null);
});

test('extractTrailingLocation: Ort nach Datum im selben Textfeld', () => {
  assert.equal(extractTrailingLocation('24. August 2026, Online'), 'Online');
  assert.equal(extractTrailingLocation('17. September 2026, Hamburg'), 'Hamburg');
});

test('extractTrailingLocation: kein Ort nach dem Datum vorhanden', () => {
  assert.equal(extractTrailingLocation('29. August 2026'), null);
  assert.equal(extractTrailingLocation(''), null);
});
