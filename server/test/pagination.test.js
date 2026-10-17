// Blätter-Funktion für Quellen: Validierung, Speichern und Lauf über mehrere
// Seiten. Der Seitenabruf wird ersetzt (deps.fetchPages), damit weder Netzwerk
// noch Headless-Browser nötig sind und die CI es ausführen kann.
process.env.EVENTS_DB_PATH = ':memory:';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const sourcesRepo = require('../src/db/sourcesRepo');
const eventsRepo = require('../src/db/eventsRepo');
const { runSource, looksDisabled } = require('../src/scraper/runSource');
const { validateSourcePagination } = require('../src/scraper/validateSource');

const BASE = {
  name: 'Testquelle',
  base_url: 'https://example.com',
  list_url: 'https://example.com/events',
  item_selector: '.card',
  title_selector: 'h3',
  date_selector: '.date',
  // Duplikate werden über URL + Titel erkannt, ohne Link gäbe es nichts zu vergleichen
  link_selector: 'a',
  category: 'Sonstiges',
  render_js: true,
};

function card(title, date) {
  return `<div class="card"><h3>${title}</h3><span class="date">${date}</span><a href="/e/${encodeURIComponent(title)}">x</a></div>`;
}
const page = (...cards) => `<html><body>${cards.join('')}</body></html>`;

// ---- validateSourcePagination ----

test('validateSourcePagination: ohne Blätter-Angaben gültig (Standard: 1 Seite)', () => {
  assert.deepEqual(validateSourcePagination({ render_js: false }), []);
  assert.deepEqual(validateSourcePagination({ render_js: true, max_pages: 1 }), []);
});

test('validateSourcePagination: Selektor + mehrere Seiten + Browser-Rendering ist gültig', () => {
  assert.deepEqual(
    validateSourcePagination({ render_js: true, next_selector: '[aria-label="Next"]', max_pages: 5 }),
    [],
  );
});

test('validateSourcePagination: mehr als eine Seite ohne Selektor wird abgelehnt', () => {
  const errors = validateSourcePagination({ render_js: true, max_pages: 3 });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Nächste-Seite-Selektor/);
});

test('validateSourcePagination: Selektor ohne Browser-Rendering wird abgelehnt', () => {
  const errors = validateSourcePagination({ render_js: false, next_selector: '.next', max_pages: 2 });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Browser-Rendering/);
});

test('validateSourcePagination: Seitenzahl muss eine ganze Zahl von 1 bis 50 sein', () => {
  for (const bad of [0, -1, 51, 2.5, 'abc']) {
    const errors = validateSourcePagination({ render_js: true, next_selector: '.n', max_pages: bad });
    assert.equal(errors.length, 1, `max_pages=${bad} sollte abgelehnt werden`);
    assert.match(errors[0], /ganze Zahl von 1 bis 50/);
  }
  assert.deepEqual(validateSourcePagination({ render_js: true, next_selector: '.n', max_pages: '4' }), []);
});

test('validateSourcePagination: Teil-Update nutzt die bisherigen Werte der Quelle', () => {
  const existing = { render_js: 1, next_selector: '.n', max_pages: 5 };
  // nur die Seitenzahl ändern: Selektor und Browser-Rendering kommen aus der bestehenden Quelle
  assert.deepEqual(validateSourcePagination({ max_pages: 10 }, existing), []);
  // Browser-Rendering ausschalten, obwohl ein Selektor gesetzt ist -> Fehler
  assert.equal(validateSourcePagination({ render_js: false }, existing).length, 1);
});

// ---- sourcesRepo ----

test('sourcesRepo: next_selector und max_pages werden gespeichert, Standard ist eine Seite', () => {
  const plain = sourcesRepo.createSource({ ...BASE, render_js: false });
  assert.equal(sourcesRepo.getSource(plain).max_pages, 1);
  assert.equal(sourcesRepo.getSource(plain).next_selector, null);

  const paged = sourcesRepo.createSource({ ...BASE, next_selector: '.next', max_pages: 4 });
  assert.equal(sourcesRepo.getSource(paged).next_selector, '.next');
  assert.equal(sourcesRepo.getSource(paged).max_pages, 4);
});

test('sourcesRepo: max_pages wird auf 1 bis 50 begrenzt', () => {
  assert.equal(sourcesRepo.normalizeMaxPages(999), 50);
  assert.equal(sourcesRepo.normalizeMaxPages(0), 1);
  assert.equal(sourcesRepo.normalizeMaxPages('abc'), 1);
  assert.equal(sourcesRepo.normalizeMaxPages(undefined), 1);
  assert.equal(sourcesRepo.normalizeMaxPages('7'), 7);
});

test('sourcesRepo.updateSource: Formularwerte (Boolean-Häkchen, leere Felder) lassen sich speichern', () => {
  // Regression: das Admin-Formular schickt render_js als Boolean; SQLite kann
  // keine Booleans binden, "Bearbeiten → Speichern" scheiterte deshalb immer.
  const id = sourcesRepo.createSource({ ...BASE, render_js: false });
  sourcesRepo.updateSource(id, {
    name: 'Umbenannt',
    render_js: true,
    active: true,
    date_selector: '',
    next_selector: '[aria-label="Next"]',
    max_pages: '3',
  });
  const s = sourcesRepo.getSource(id);
  assert.equal(s.name, 'Umbenannt');
  assert.equal(s.render_js, 1);
  assert.equal(s.active, 1);
  assert.equal(s.date_selector, null);
  assert.equal(s.next_selector, '[aria-label="Next"]');
  assert.equal(s.max_pages, 3);
});

// ---- runSource über mehrere Seiten ----

test('runSource: liest alle gelieferten Seiten aus und zählt sie', async () => {
  const id = sourcesRepo.createSource({ ...BASE, name: 'Mehrseitig', next_selector: '.next', max_pages: 3 });
  const source = sourcesRepo.getSource(id);
  const fetchPages = async () => [
    page(card('Alpha Hackathon A', '17 Oct 2026'), card('Alpha Hackathon B', '18 Oct 2026')),
    page(card('Beta Hackathon C', '19 Oct 2026')),
    page(card('Gamma Hackathon D', '20 Oct 2026'), card('Gamma Hackathon E', '21 Oct 2026')),
  ];

  const result = await runSource(source, { fetchPages });

  assert.equal(result.total, 5);
  assert.equal(result.inserted, 5);
  assert.equal(result.pages, 3);
  const titles = eventsRepo
    .listEvents({ status: 'pending' })
    .filter((e) => e.source === 'Mehrseitig')
    .map((e) => e.title)
    .sort();
  assert.deepEqual(titles, [
    'Alpha Hackathon A', 'Alpha Hackathon B', 'Beta Hackathon C', 'Gamma Hackathon D', 'Gamma Hackathon E',
  ]);
  assert.match(sourcesRepo.getSource(id).last_run_status, /3 Seiten/);
});

test('runSource: derselbe Eintrag auf zwei Seiten wird nur einmal angelegt', async () => {
  const id = sourcesRepo.createSource({ ...BASE, name: 'Doppelt', next_selector: '.next', max_pages: 2 });
  const source = sourcesRepo.getSource(id);
  const fetchPages = async () => [
    page(card('Gleiches Event', '17 Oct 2026'), card('Anderes Event', '18 Oct 2026')),
    page(card('Gleiches Event', '17 Oct 2026')),
  ];

  const result = await runSource(source, { fetchPages });

  assert.equal(result.inserted, 2);
  assert.equal(result.skipped, 1);
});

test('runSource: eine einzige Seite verhält sich wie bisher (kein Seiten-Hinweis im Status)', async () => {
  const id = sourcesRepo.createSource({ ...BASE, name: 'Einseitig', render_js: false });
  const source = sourcesRepo.getSource(id);
  const result = await runSource(source, {
    fetchPages: async () => [page(card('Einzelnes Event', '22 Oct 2026'))],
  });
  assert.equal(result.inserted, 1);
  assert.equal(result.pages, 1);
  assert.doesNotMatch(sourcesRepo.getSource(id).last_run_status, /Seiten/);
});

// ---- looksDisabled (Erkennung des gesperrten "Weiter"-Knopfs) ----

test('looksDisabled: erkennt disabled-Attribut und aria-disabled', () => {
  assert.equal(looksDisabled({ disabled: true }), true);
  assert.equal(looksDisabled({ ariaDisabled: 'true' }), true);
});

test('looksDisabled: erkennt Klassen, die selbst "disabled" heißen', () => {
  assert.equal(looksDisabled({ className: 'btn disabled' }), true);
  assert.equal(looksDisabled({ className: 'pagination__next is-disabled' }), true);
  assert.equal(looksDisabled({ className: 'btn btn--disabled' }), true);
});

test('looksDisabled: Tailwind-Varianten "disabled:…" zählen nicht (Regression Hackathon Hub)', () => {
  const tailwind =
    'inline-flex items-center justify-center rounded-md text-sm font-medium disabled:pointer-events-none disabled:opacity-50 hover:bg-accent';
  assert.equal(looksDisabled({ className: tailwind, ariaDisabled: null, disabled: false }), false);
});

test('looksDisabled: normaler Knopf ist nicht gesperrt', () => {
  assert.equal(looksDisabled({ className: 'btn btn-primary', ariaDisabled: 'false' }), false);
  assert.equal(looksDisabled({}), false);
  assert.equal(looksDisabled(), false);
});
