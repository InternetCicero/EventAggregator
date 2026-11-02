// Quellen, deren Event-Karten keinen eigenen Link haben (z. B. WU Wien: Details
// öffnen sich per JavaScript). Duplikate werden dann über Titel + Startzeit
// erkannt, als Event-Link dient die Listen-URL.
process.env.EVENTS_DB_PATH = ':memory:';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const sourcesRepo = require('../src/db/sourcesRepo');
const eventsRepo = require('../src/db/eventsRepo');
const { runSource } = require('../src/scraper/runSource');

const LIST_URL = 'https://uni.example/events';
const BASE = {
  name: 'Ohne Link',
  base_url: 'https://uni.example',
  list_url: LIST_URL,
  item_selector: '.event-card-list:not(.slider) .list > .item[data-id]',
  title_selector: 'h3',
  date_selector: '.schedule:has(.icon-time-filled)',
  location_selector: '.schedule:has(.icon-marker-dark)',
  category: 'Bildung & Vortrag',
  render_js: false,
};

function item(id, title, schedule, where = 'Vor Ort') {
  return `<div data-id="${id}" class="item"><h3>${title}</h3>
    <div class="schedule"><span class="icon-time-filled"></span>${schedule}</div>
    <div class="schedule"><span class="icon-marker-dark"></span>${where}</div>
    <button type="button">Mehr erfahren</button></div>`;
}
const html = (...items) =>
  `<html><body>
    <div class="event-card-list slider"><div class="list">${item(1, 'Nur im Slider', '01.12.2026 10:00 - 11:00')}</div></div>
    <div class="event-card-list"><div class="list">${items.join('')}
      <div class="item"><h3>Event verpasst?</h3></div></div></div>
  </body></html>`;

test('ohne Link: Events werden gespeichert, Listen-URL ist der Link, Slider und Hinweiskarte fehlen', async () => {
  const id = sourcesRepo.createSource(BASE);
  const source = sourcesRepo.getSource(id);
  const result = await runSource(source, {
    fetchPages: async () => [html(item(10, 'WU x TU matters', '04.11.2026 18:00 - 19:30'), item(11, 'Info Session', '12.11.2026 18:00 - 19:00', 'Online'))],
  });
  assert.equal(result.inserted, 2);
  const events = eventsRepo.listEvents({ status: 'pending' }).filter((e) => e.source === 'Ohne Link');
  assert.deepEqual(events.map((e) => e.title).sort(), ['Info Session', 'WU x TU matters']);
  assert.ok(events.every((e) => e.url === LIST_URL));
  assert.equal(events.find((e) => e.title === 'Info Session').format, 'online');
});

test('ohne Link: zweiter Lauf legt keine Duplikate an', async () => {
  const id = sourcesRepo.createSource({ ...BASE, name: 'Zweimal' });
  const source = sourcesRepo.getSource(id);
  const fetchPages = async () => [html(item(20, 'Colloquium', '16.11.2026 16:30 - 19:30'))];
  assert.equal((await runSource(source, { fetchPages })).inserted, 1);
  const second = await runSource(source, { fetchPages });
  assert.equal(second.inserted, 0);
  assert.equal(second.skipped, 1);
});

test('ohne Link: gleicher Titel an anderem Termin ist kein Duplikat', async () => {
  const id = sourcesRepo.createSource({ ...BASE, name: 'Serie' });
  const source = sourcesRepo.getSource(id);
  const result = await runSource(source, {
    fetchPages: async () => [
      html(item(30, 'Infoabend', '16.11.2026 18:30 - 19:30'), item(31, 'Infoabend', '23.11.2026 18:30 - 19:30')),
    ],
  });
  assert.equal(result.inserted, 2);
});

test('mit Link: Verhalten unverändert (URL bleibt die Event-URL)', async () => {
  const id = sourcesRepo.createSource({ ...BASE, name: 'Mit Link', link_selector: 'a' });
  const source = sourcesRepo.getSource(id);
  const withLink = `<div data-id="40" class="item"><h3>Linked</h3><a href="/e/40">x</a>
    <div class="schedule"><span class="icon-time-filled"></span>05.11.2026 10:00</div></div>`;
  await runSource(source, {
    fetchPages: async () => [`<div class="event-card-list"><div class="list">${withLink}</div></div>`],
  });
  const e = eventsRepo.listEvents({ status: 'pending' }).find((x) => x.source === 'Mit Link');
  assert.equal(e.url, 'https://uni.example/e/40');
});

// Blättern per normalem Link (ganze Seite wird neu geladen, wie bei WU Wien).
// Braucht Chromium; ohne installierten Browser wird der Test übersprungen.
test('Blättern über Seitenwechsel-Links liest beide Seiten und endet auf der letzten', async (t) => {
  const http = require('node:http');
  let chromiumOk = true;
  try {
    const b = await require('playwright').chromium.launch();
    await b.close();
  } catch {
    chromiumOk = false;
  }
  if (!chromiumOk) return t.skip('Chromium nicht installiert');

  const pageHtml = (n) => {
    const events = n === 1
      ? item(50, 'Seite eins A', '01.12.2026 10:00') + item(51, 'Seite eins B', '02.12.2026 10:00')
      : item(52, 'Seite zwei A', '03.12.2026 10:00');
    const next = n === 1 ? '<a class="next" href="/p2">weiter</a>' : '';
    return `<html><body><div class="event-card-list"><div class="list">${events}</div></div>${next}</body></html>`;
  };
  const server = http.createServer((req, res) => {
    // Seite 2 lädt bewusst verzögert, damit der Zwischenzustand ohne Events auftritt
    setTimeout(() => {
      res.setHeader('content-type', 'text/html');
      res.end(pageHtml(req.url === '/p2' ? 2 : 1));
    }, req.url === '/p2' ? 600 : 0);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const id = sourcesRepo.createSource({
      ...BASE, name: 'Seitenwechsel', base_url: base, list_url: `${base}/`,
      item_selector: '.event-card-list .list > .item[data-id]',
      render_js: true, next_selector: 'a.next', max_pages: 5,
    });
    const result = await runSource(sourcesRepo.getSource(id));
    assert.equal(result.pages, 2);
    assert.equal(result.inserted, 3);
  } finally {
    server.close();
  }
});
