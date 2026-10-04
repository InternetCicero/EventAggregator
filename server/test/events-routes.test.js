// Öffentliche Event-Liste: vergangene Events standardmäßig ausblenden.
process.env.EVENTS_DB_PATH = ':memory:';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const eventsRepo = require('../src/db/eventsRepo');

let server;
let base;

function iso(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

before(async () => {
  const make = (title, start, end) =>
    eventsRepo.createEvent({ title, category: 'Sonstiges', start_date: start, end_date: end, status: 'approved' });
  make('Vorbei', `${iso(-10)}T18:00`);
  make('Heute', `${iso(0)}T09:00`);
  make('Morgen', `${iso(1)}T18:00`);
  make('Laeuft noch', `${iso(-3)}T09:00`, `${iso(2)}T18:00`);

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => server.close());

test('ohne Zeitraum: nur laufende und kommende Events', async () => {
  const titles = (await (await fetch(`${base}/events`)).json()).map((e) => e.title).sort();
  assert.deepEqual(titles, ['Heute', 'Laeuft noch', 'Morgen']);
});

test('mit eigenem "from" in der Vergangenheit sind alte Events abrufbar', async () => {
  const titles = (await (await fetch(`${base}/events?from=${iso(-30)}`)).json()).map((e) => e.title);
  assert.ok(titles.includes('Vorbei'));
});
