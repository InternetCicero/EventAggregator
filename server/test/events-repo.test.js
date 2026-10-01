// Eigene, isolierte In-Memory-Datenbank für diese Testdatei — fasst nicht
// die echte data/events.db an. Muss vor jedem require von db/index.js
// (direkt oder über eventsRepo) gesetzt sein.
process.env.EVENTS_DB_PATH = ':memory:';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const eventsRepo = require('../src/db/eventsRepo');

function makeEvent(overrides = {}) {
  return {
    title: 'Testevent',
    category: 'Sonstiges',
    start_date: '2026-10-01T18:00',
    status: 'pending',
    source: 'manual',
    ...overrides,
  };
}

test('createEvent + getEvent: legt ein Event an und liest es inklusive Tags zurück', () => {
  const id = eventsRepo.createEvent(makeEvent({ tags: ['Open Air', 'Gratis'] }));
  const event = eventsRepo.getEvent(id);
  assert.equal(event.title, 'Testevent');
  // Tags werden klein geschrieben gespeichert
  assert.deepEqual(event.tags.sort(), ['gratis', 'open air']);
});

test('listEvents: filtert standardmäßig auf status=approved', () => {
  eventsRepo.createEvent(makeEvent({ title: 'Nur ausstehend', status: 'pending' }));
  const approvedId = eventsRepo.createEvent(makeEvent({ title: 'Freigegeben', status: 'approved' }));

  const approved = eventsRepo.listEvents();
  assert.ok(approved.some((e) => e.id === approvedId));
  assert.ok(!approved.some((e) => e.title === 'Nur ausstehend'));
});

test('listEvents: Kategorie- und Tag-Filter', () => {
  eventsRepo.createEvent(
    makeEvent({ title: 'Konzert', category: 'Musik', status: 'approved', tags: ['open air'] }),
  );
  eventsRepo.createEvent(
    makeEvent({ title: 'Vortrag', category: 'Bildung & Vortrag', status: 'approved', tags: ['online'] }),
  );

  const musik = eventsRepo.listEvents({ category: 'Musik' });
  assert.ok(musik.every((e) => e.category === 'Musik'));
  assert.ok(musik.some((e) => e.title === 'Konzert'));

  const openAir = eventsRepo.listEvents({ tag: 'open air' });
  assert.ok(openAir.some((e) => e.title === 'Konzert'));
  assert.ok(!openAir.some((e) => e.title === 'Vortrag'));
});

test('updateEventStatus + deleteEvent', () => {
  const id = eventsRepo.createEvent(makeEvent({ status: 'pending' }));
  eventsRepo.updateEventStatus(id, 'approved');
  assert.equal(eventsRepo.getEvent(id).status, 'approved');

  eventsRepo.deleteEvent(id);
  assert.equal(eventsRepo.getEvent(id), null);
});

test('bulkUpdateStatus: setzt den Status mehrerer Events in einem Rutsch', () => {
  const id1 = eventsRepo.createEvent(makeEvent({ title: 'A', status: 'pending' }));
  const id2 = eventsRepo.createEvent(makeEvent({ title: 'B', status: 'pending' }));
  const id3 = eventsRepo.createEvent(makeEvent({ title: 'C', status: 'pending' }));

  const affected = eventsRepo.bulkUpdateStatus([id1, id2], 'approved');

  assert.equal(affected, 2);
  assert.equal(eventsRepo.getEvent(id1).status, 'approved');
  assert.equal(eventsRepo.getEvent(id2).status, 'approved');
  assert.equal(eventsRepo.getEvent(id3).status, 'pending'); // nicht in der Auswahl
});

test('bulkUpdateStatus: nicht existierende IDs werden übersprungen statt zu scheitern', () => {
  const id = eventsRepo.createEvent(makeEvent({ status: 'pending' }));
  const affected = eventsRepo.bulkUpdateStatus([id, 999999], 'rejected');
  assert.equal(affected, 1);
  assert.equal(eventsRepo.getEvent(id).status, 'rejected');
});

test('bulkDelete: löscht mehrere Events in einem Rutsch', () => {
  const id1 = eventsRepo.createEvent(makeEvent());
  const id2 = eventsRepo.createEvent(makeEvent());

  const affected = eventsRepo.bulkDelete([id1, id2]);

  assert.equal(affected, 2);
  assert.equal(eventsRepo.getEvent(id1), null);
  assert.equal(eventsRepo.getEvent(id2), null);
});

test('findDuplicateByUrlAndTitle: erkennt nur exakt gleiche URL+Titel-Kombination', () => {
  const url = 'https://example.com/event/roadshow';
  eventsRepo.createEvent(makeEvent({ title: 'Roadshow Berlin', url }));

  // Gleiche URL, aber anderer Titel (z.B. andere Stadt derselben Roadshow) -> kein Duplikat
  assert.equal(eventsRepo.findDuplicateByUrlAndTitle(url, 'Roadshow Hamburg'), undefined);

  // Gleiche URL UND gleicher Titel -> Duplikat
  assert.ok(eventsRepo.findDuplicateByUrlAndTitle(url, 'Roadshow Berlin'));
});

test('findDuplicateByUrlAndTitle: ohne URL nie ein Duplikat', () => {
  assert.equal(eventsRepo.findDuplicateByUrlAndTitle(null, 'Irgendwas'), null);
});

test('listAllTags: listet verwendete Tags alphabetisch und ohne Duplikate', () => {
  // Tests in dieser Datei teilen sich eine In-Memory-DB, daher nur auf die
  // hier angelegten Tags prüfen statt auf den gesamten (von anderen Tests
  // mitbefüllten) Tag-Bestand.
  eventsRepo.createEvent(makeEvent({ tags: ['Einzigartiges-Tag-Zebra', 'einzigartiges-tag-apfel'] }));
  eventsRepo.createEvent(makeEvent({ tags: ['einzigartiges-tag-apfel'] }));
  const tags = eventsRepo.listAllTags();

  const apfelCount = tags.filter((t) => t === 'einzigartiges-tag-apfel').length;
  assert.equal(apfelCount, 1, 'Tag darf trotz zweifacher Vergabe nur einmal in der Liste stehen');
  assert.ok(tags.includes('einzigartiges-tag-zebra'));

  const sorted = [...tags].sort();
  assert.deepEqual(tags, sorted, 'Tags müssen alphabetisch sortiert sein');
});
