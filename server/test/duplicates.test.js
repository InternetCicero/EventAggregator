// Duplikaterkennung über mehrere Quellen (Spec: 2026-11-03-event-duplikate.md).
// Der Seitenabruf wird ersetzt (deps.fetchPages), damit kein Netzwerk nötig ist.
process.env.EVENTS_DB_PATH = ':memory:';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'testpass';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const sourcesRepo = require('../src/db/sourcesRepo');
const eventsRepo = require('../src/db/eventsRepo');
const { runSource } = require('../src/scraper/runSource');
const { normalizeTitle, titleSimilarity, classifyPair } = require('../src/db/duplicates');

const adminAuth = { Authorization: 'Basic ' + Buffer.from('admin:testpass').toString('base64') };

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const BASE_SOURCE = {
  base_url: 'https://example.com',
  list_url: 'https://example.com/events',
  item_selector: '.card',
  title_selector: 'h3',
  date_selector: '.date',
  location_selector: '.loc',
  link_selector: 'a',
  category: 'Consulting',
  render_js: false,
};

function card(title, date, loc, href) {
  return `<div class="card"><h3>${title}</h3><span class="date">${date}</span><span class="loc">${loc}</span><a href="${href}">x</a></div>`;
}
const page = (...cards) => `<html><body>${cards.join('')}</body></html>`;
function newSource(name) {
  const id = sourcesRepo.createSource({ ...BASE_SOURCE, name });
  return sourcesRepo.getSource(id);
}
const run = (source, ...cards) => runSource(source, { fetchPages: async () => [page(...cards)] });
const byTitle = (title) => eventsRepo.listEvents({ status: 'pending', from: '2000-01-01' }).find((e) => e.title === title);

// ---- Normalisierung und Ähnlichkeit (AC-3, AC-4, AC-5, AC-6) ----

test('AC-3: gleiche Wörter in anderer Reihenfolge, mit Füllwörtern, Jahr, Satzzeichen und Akzenten sind gleich', () => {
  assert.deepEqual(
    normalizeTitle('McKinsey | Case Workshop 2026').sort(),
    normalizeTitle('Case Workshop mit McKinsey').sort(),
  );
  assert.equal(titleSimilarity('McKinsey | Case Workshop 2026', 'Case Workshop mit McKinsey'), 1);
  assert.equal(titleSimilarity('Karrieretag Würzburg', 'KARRIERETAG Wurzburg!'), 1);
});

test('Zusatzwörter in einem Titel (z. B. Firmenname) ergeben nur ein mögliches Duplikat', () => {
  const day = { start_date: '2026-11-12' };
  const hit = classifyPair({ ...day, title: 'Karrieremesse Konstanz 2026' }, { ...day, title: 'McKinsey bei der Karrieremesse Konstanz' });
  assert.equal(hit.level, 'possible');
});

test('verschiedene Firmen mit demselben Veranstaltungstyp sind kein Duplikat', () => {
  assert.ok(titleSimilarity('BCG Case Workshop', 'McKinsey Case Workshop') < 0.6);
});

test('AC-4: anderer Kalendertag ist kein Duplikat, gleicher Tag mit anderer Uhrzeit schon', () => {
  const a = { title: 'Case Workshop', start_date: '2026-11-05T10:00' };
  assert.equal(classifyPair(a, { title: 'Case Workshop', start_date: '2026-11-06T10:00' }), null);
  assert.equal(classifyPair(a, { title: 'Case Workshop', start_date: '2026-11-05T16:30' }).level, 'duplicate');
});

test('AC-5: verschiedene Orte sind kein Duplikat, passende oder fehlende Orte schon', () => {
  const a = { title: 'Case Workshop', start_date: '2026-11-05', location: 'Berlin' };
  assert.equal(classifyPair(a, { ...a, location: 'München' }), null);
  assert.equal(classifyPair(a, { ...a, location: 'Berlin, Germany' }).level, 'duplicate');
  assert.equal(classifyPair(a, { ...a, location: null }).level, 'duplicate');
});

test('Einstufung: ab 0,9 Duplikat, ab 0,6 mögliches Duplikat, darunter nichts', () => {
  const day = { start_date: '2026-11-05' };
  assert.equal(classifyPair({ ...day, title: 'a b c d e f g h i j' }, { ...day, title: 'a b c d e f g h i j' }).level, 'duplicate');
  assert.equal(classifyPair({ ...day, title: 'alpha beta gamma' }, { ...day, title: 'alpha beta gamma delta' }).level, 'possible');
  assert.equal(classifyPair({ ...day, title: 'alpha beta' }, { ...day, title: 'gamma delta' }), null);
});

// ---- Scraper (AC-1, AC-2, AC-6, AC-11, AC-12, AC-14, AC-15) ----

test('AC-1/14/11: eindeutiges Duplikat aus zweiter Quelle wird nicht gespeichert, die Quelle wird vermerkt', async () => {
  const mckinsey = newSource('McKinsey Events');
  const efellows = newSource('e-fellows');
  await run(mckinsey, card('Karrieremesse Konstanz 2026', '12.11.2026', 'Konstanz', '/m/konstanz'));
  const result = await run(efellows, card('Karrieremesse Konstanz', '12.11.2026', 'Konstanz', '/e/konstanz'));

  assert.equal(result.inserted, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.crossSource, 1);
  assert.match(sourcesRepo.getSource(efellows.id).last_run_status, /1 Duplikate \(1 quellenübergreifend\)/);

  const event = byTitle('Karrieremesse Konstanz 2026');
  assert.deepEqual(event.also_listed, [
    { source: 'e-fellows', url: 'https://example.com/e/konstanz', title: 'Karrieremesse Konstanz' },
  ]);
  assert.equal(eventsRepo.listEvents({ status: 'pending', from: '2000-01-01' }).filter((e) => /Konstanz/.test(e.title)).length, 1);
});

test('AC-15: wiederholter Lauf legt keinen weiteren Eintrag an, mehrere Quellen werden gesammelt', async () => {
  const mckinsey = sourcesRepo.listSources().find((s) => s.name === 'McKinsey Events');
  const efellows = sourcesRepo.listSources().find((s) => s.name === 'e-fellows');
  const third = newSource('BCG Events');
  await run(efellows, card('Karrieremesse Konstanz', '12.11.2026', 'Konstanz', '/e/konstanz'));
  await run(third, card('Karrieremesse Konstanz', '12.11.2026', '', '/b/konstanz'));
  // dieselbe Quelle liest ihr eigenes Event erneut: wie bisher Duplikat über URL + Titel
  const again = await run(mckinsey, card('Karrieremesse Konstanz 2026', '12.11.2026', 'Konstanz', '/m/konstanz'));
  assert.equal(again.skipped, 1);
  assert.equal(again.crossSource, 0);

  const event = byTitle('Karrieremesse Konstanz 2026');
  assert.deepEqual(event.also_listed.map((l) => l.source), ['e-fellows', 'BCG Events']);
  assert.equal(eventsRepo.addListing(event.id, { source: 'McKinsey Events', url: 'x', title: 'x' }), false);
});

test('AC-12: gleiches Event derselben Quelle setzt kein duplicate_of', async () => {
  const src = newSource('Einzelquelle');
  await run(src, card('Info Session Alpha', '20.11.2026', 'Wien', '/a'));
  await run(src, card('Info Session Alpha', '20.11.2026', 'Wien', '/a'));
  assert.equal(byTitle('Info Session Alpha').duplicate_of, null);
});

test('mehrere ähnliche Termine derselben Quelle am selben Tag bleiben getrennt', async () => {
  const src = newSource('Serienquelle');
  const result = await run(
    src,
    card('Infoabend Beratung', '25.11.2026', 'Köln', '/s/1'),
    card('Infoabend Beratung', '25.11.2026', 'Köln', '/s/2'),
  );
  assert.equal(result.inserted, 2);
});

test('AC-2: ähnlicher, aber nicht gleicher Titel wird gespeichert und als mögliches Duplikat markiert', async () => {
  const a = newSource('Quelle Alpha');
  const b = newSource('Quelle Beta');
  await run(a, card('Women in Tech Panel München', '27.11.2026', 'München', '/a/1'));
  const result = await run(b, card('Women in Tech Panel Abend München Special', '27.11.2026', 'München', '/b/1'));
  assert.equal(result.inserted, 1);
  assert.equal(result.flagged, 1);
  assert.match(sourcesRepo.getSource(b.id).last_run_status, /1 markiert/);
  const flagged = byTitle('Women in Tech Panel Abend München Special');
  assert.equal(flagged.duplicate_of, byTitle('Women in Tech Panel München').id);
  assert.equal(flagged.duplicate_of_title, 'Women in Tech Panel München');
  assert.equal(flagged.duplicate_of_source, 'Quelle Alpha');
  assert.deepEqual(flagged.also_listed, []);
});

test('AC-6: ohne erkennbares Datum wird nicht quellenübergreifend verglichen', async () => {
  const a = newSource('Datum Alpha');
  const b = newSource('Datum Beta');
  const today = new Date().toISOString().slice(0, 10);
  await run(a, card('Datumsloses Event Zeta', today, '', '/z/1'));
  const result = await run(b, card('Datumsloses Event Zeta', 'bald', '', '/z/2'));
  assert.equal(result.inserted, 1);
  assert.equal(result.crossSource, 0);
});

test('Status ohne Duplikate bleibt im bisherigen Format', async () => {
  const src = newSource('Ohne Treffer');
  await run(src, card('Einzigartiges Event Omega', '30.11.2026', 'Hamburg', '/o'));
  assert.equal(sourcesRepo.getSource(src.id).last_run_status, 'ok: 1 neu, 0 Duplikate, 0 Fehler');
});

test('Duplikate aus abgelehnten Events kommen nicht über eine zweite Quelle zurück', async () => {
  const a = newSource('Reject Alpha');
  const b = newSource('Reject Beta');
  await run(a, card('Abgelehntes Spezialevent', '02.12.2026', 'Essen', '/r/1'));
  eventsRepo.updateEventStatus(byTitle('Abgelehntes Spezialevent').id, 'rejected');
  const result = await run(b, card('Abgelehntes Spezialevent', '02.12.2026', 'Essen', '/r/2'));
  assert.equal(result.inserted, 0);
  assert.equal(result.crossSource, 1);
});

// ---- Formular (AC-7, AC-8) und API (AC-9, AC-13, AC-17, AC-18) ----

const post = (body) =>
  fetch(`${base}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('AC-7: eindeutiges Duplikat per Formular wird mit 409 und Hinweis zurückgewiesen', async () => {
  const res = await post({ title: 'Abgelehntes Spezialevent', category: 'Sonstiges', start_date: '2026-12-02T18:00', location: 'Essen' });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.match(body.error, /bereits vorhanden: „Abgelehntes Spezialevent“ \(Reject Alpha\)/);
  assert.equal(body.duplicate.source, 'Reject Alpha');
});

test('AC-8: mögliches Duplikat per Formular wird gespeichert und markiert; neues Event ohne Treffer normal', async () => {
  const res = await post({ title: 'Women in Tech Panel München Spezial Gast', category: 'Sonstiges', start_date: '2026-11-27T19:00', location: 'München' });
  assert.equal(res.status, 201);
  const { id } = await res.json();
  assert.ok(eventsRepo.getEvent(id).duplicate_of);

  const fresh = await post({ title: 'Ganz Anderes Event Sigma', category: 'Sonstiges', start_date: '2026-11-27T19:00' });
  assert.equal(fresh.status, 201);
  assert.equal(eventsRepo.getEvent((await fresh.json()).id).duplicate_of, null);
});

test('manuelle Einreichungen untereinander werden verglichen', async () => {
  const body = { title: 'Zweimal Eingereicht Event', category: 'Sonstiges', start_date: '2026-12-05T18:00', location: 'Bonn' };
  assert.equal((await post(body)).status, 201);
  assert.equal((await post(body)).status, 409);
});

test('AC-9: Admin-Liste liefert Verweis und Filter "nur mögliche Duplikate"', async () => {
  const all = await (await fetch(`${base}/admin/events?status=pending`, { headers: adminAuth })).json();
  const only = await (await fetch(`${base}/admin/events?status=pending&duplicates=1`, { headers: adminAuth })).json();
  assert.ok(all.length > only.length);
  assert.ok(only.length >= 2);
  assert.ok(only.every((e) => e.duplicate_of && e.duplicate_of_title));
});

test('AC-13: markierte Events lassen sich normal freigeben und ablehnen', async () => {
  const only = await (await fetch(`${base}/admin/events?status=pending&duplicates=1`, { headers: adminAuth })).json();
  const res = await fetch(`${base}/admin/events/${only[0].id}/approve`, { method: 'POST', headers: adminAuth });
  assert.equal(res.status, 200);
  assert.equal(eventsRepo.getEvent(only[0].id).status, 'approved');
});

test('AC-17/18: öffentliche API liefert also_listed (leer bei Events ohne weitere Quelle)', async () => {
  const published = byTitle('Karrieremesse Konstanz 2026');
  eventsRepo.updateEventStatus(published.id, 'approved');
  const list = await (await fetch(`${base}/events?from=2000-01-01`)).json();
  const konstanz = list.find((e) => e.title === 'Karrieremesse Konstanz 2026');
  assert.deepEqual(konstanz.also_listed.map((l) => l.source), ['e-fellows', 'BCG Events']);
  const single = await (await fetch(`${base}/events/${konstanz.id}`)).json();
  assert.equal(single.also_listed.length, 2);
  assert.ok(list.filter((e) => e.id !== konstanz.id).every((e) => Array.isArray(e.also_listed)));
});
