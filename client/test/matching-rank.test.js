// Empfehlungs-Rechnung (Spec 2026-11-07-fuer-dich, AC-12 bis AC-14, AC-16 bis AC-20)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankEvents } from '../src/lib/matching/index.js';
import { emptyProfile } from '../src/lib/matching/profile.js';

const TODAY = '2026-11-07';
let nextId = 1;

function ev(overrides = {}) {
  return {
    id: nextId++,
    title: 'Event',
    description: '',
    category: 'Sonstiges',
    format: 'onsite',
    location: 'Berlin',
    start_date: '2026-11-17T18:00',
    end_date: null,
    tags: [],
    source: 'Quelle A',
    ...overrides,
  };
}

function profile(overrides = {}) {
  return { ...emptyProfile(), ...overrides, cities: { ...emptyProfile().cities, ...(overrides.cities || {}) } };
}

const all = (r) => [...r.top, ...r.maybe];

test('AC-20: Rechenbeispiel aus der Spec ergibt 99 und 21', () => {
  const p = profile({
    categories: ['Consulting', 'Workshop & Case Study'],
    keywords: ['case'],
    cities: { primary: 'München' },
    acceptOnline: true,
    horizonDays: 60,
  });
  const workshop = ev({
    title: 'Case-Workshop Strategy',
    category: 'Workshop & Case Study',
    format: 'onsite',
    location: 'München',
    start_date: '2026-11-17T10:00',
    source: 'A',
  });
  const networking = ev({
    title: 'Online-Networking Banking',
    category: 'Networking',
    format: 'online',
    location: 'Online',
    start_date: '2026-12-07T18:00',
    source: 'B',
  });
  const r = rankEvents([workshop, networking], p, { today: TODAY });
  assert.equal(r.top.length, 1);
  assert.equal(r.top[0].item.id, workshop.id);
  assert.equal(r.top[0].score, 99);
  assert.equal(r.maybe.length, 0);
  assert.equal(r.otherCount, 1); // Networking mit 21 liegt unter 30
});

test('AC-12: ohne aktives Profil keine Empfehlungen', () => {
  const r = rankEvents([ev()], profile({ formats: ['online'] }), { today: TODAY });
  assert.deepEqual(r, { top: [], maybe: [], otherCount: 0 });
});

test('AC-13: ausgeschlossene Kategorie, vergangene und zu weit entfernte Events fallen raus', () => {
  const p = profile({ keywords: ['case'], excludedCategories: ['Hackathon'], horizonDays: 30 });
  const r = rankEvents(
    [
      ev({ title: 'Case Hackathon', category: 'Hackathon' }),
      ev({ title: 'Case gestern', start_date: '2026-11-06T10:00' }),
      ev({ title: 'Case in 31 Tagen', start_date: '2026-12-08T10:00' }),
      ev({ title: 'Case in 30 Tagen', start_date: '2026-12-07T10:00' }),
      ev({ title: 'Case läuft noch', start_date: '2026-11-01T10:00', end_date: '2026-11-09T18:00' }),
    ],
    p,
    { today: TODAY },
  );
  const titles = all(r).map((x) => x.item.title).sort();
  assert.deepEqual(titles, ['Case in 30 Tagen', 'Case läuft noch']);
  assert.equal(r.otherCount, 0);
});

test('AC-14: nur anwendbare Teilbewertungen zählen (dünnes Profil ist fair)', () => {
  // Nur Kategorie gesetzt: Kategorie 40/40 + Zeitnähe -> nahe 100, keine Strafe für leere Felder
  const p = profile({ categories: ['Consulting'] });
  const r = rankEvents([ev({ category: 'Consulting', start_date: '2026-11-07T18:00' })], p, { today: TODAY });
  assert.equal(r.top[0].score, 100);
});

test('Ort zählt nur mit Stadt; Online-Event bei "Online okay" 80 %', () => {
  const p = profile({ keywords: ['case'], cities: { primary: 'Hamburg' }, acceptOnline: true });
  const online = ev({ title: 'Case online', format: 'online', location: 'Zoom', start_date: '2026-11-07T18:00' });
  const r = rankEvents([online], p, { today: TODAY });
  // (25 + 16 + 5) / 50
  assert.equal(all(r)[0].score, 92);
  const noOnline = rankEvents([online], { ...p, acceptOnline: false }, { today: TODAY });
  // (25 + 0 + 5) / 50
  assert.equal(all(noOnline)[0].score, 60);
});

test('Schlagwort: Beschreibung zählt 60 %, zwei schwache Treffer zählen voll', () => {
  const p = profile({ keywords: ['case', 'strategy'] });
  const weak = ev({ description: 'Ein Case zum Thema Pricing', start_date: '2026-11-07T18:00' });
  const twoWeak = ev({ description: 'Case und Strategy', start_date: '2026-11-07T18:00' });
  const r = rankEvents([weak, twoWeak], p, { today: TODAY });
  const byId = Object.fromEntries(all(r).map((x) => [x.item.id, x.score]));
  assert.equal(byId[weak.id], 67); // (15 + 5) / 30 = 66,7
  assert.equal(byId[twoWeak.id], 100); // min(1, 0,6 + 0,6) -> (25 + 5) / 30
});

test('AC-16: Gleichstand -> früheres Event zuerst, dann kleinere ID', () => {
  const p = profile({ categories: ['Consulting'], horizonDays: 60 });
  // Verschiedene Quellen, damit kein Vielfaltsabzug greift
  const later = ev({ category: 'Consulting', start_date: '2026-11-07T18:00', source: 'X' });
  const earlier = ev({ category: 'Consulting', start_date: '2026-11-07T09:00', source: 'Y' });
  const sameA = ev({ category: 'Consulting', start_date: '2026-11-07T12:00', source: 'Z1' });
  const sameB = ev({ category: 'Consulting', start_date: '2026-11-07T12:00', source: 'Z2' });
  const ids = all(rankEvents([later, sameB, earlier, sameA], p, { today: TODAY })).map((x) => x.item.id);
  assert.deepEqual(ids, [earlier.id, sameA.id, sameB.id, later.id]);
});

test('AC-17: Vielfaltsabzug 10 % pro weiterem Event derselben Quelle', () => {
  const p = profile({ categories: ['Consulting'] });
  const day = '2026-11-07T10:00';
  const a1 = ev({ category: 'Consulting', start_date: day, source: 'PwC' });
  const a2 = ev({ category: 'Consulting', start_date: day, source: 'PwC' });
  const a3 = ev({ category: 'Consulting', start_date: day, source: 'PwC' });
  // b: etwas schwächer (später), aber über 90 % von a2
  const b = ev({ category: 'Consulting', start_date: '2026-11-17T10:00', source: 'Deloitte' });
  const r = rankEvents([a1, a2, a3, b], p, { today: TODAY });
  const order = all(r).map((x) => x.item.id);
  assert.deepEqual(order, [a1.id, b.id, a2.id, a3.id]);
  // Gruppe richtet sich nach dem echten Score, nicht dem Abzug
  assert.ok(r.top.every((x) => x.score >= 60));
});

test('AC-18: Gruppen nach Schwellen 60 und 30', () => {
  const p = profile({ categories: ['Consulting'], keywords: ['case'] });
  const r = rankEvents(
    [
      ev({ category: 'Consulting', title: 'Case Night', start_date: '2026-11-07T18:00', source: '1' }), // 100
      ev({ category: 'Consulting', start_date: '2026-11-07T18:00', source: '2' }), // (40+0+5)/70 = 64
      ev({ title: 'Case Night', start_date: '2026-11-07T18:00', source: '3' }), // (0+25+5)/70 = 43
      ev({ start_date: '2026-11-07T18:00', source: '4' }), // 5/70 = 7
    ],
    p,
    { today: TODAY },
  );
  assert.deepEqual(r.top.map((x) => x.score), [100, 64]);
  assert.deepEqual(r.maybe.map((x) => x.score), [43]);
  assert.equal(r.otherCount, 1);
});

test('AC-19: Gründe in fester Reihenfolge, höchstens 3', () => {
  const p = profile({ categories: ['Consulting'], keywords: ['case'], cities: { primary: 'München' }, formats: ['onsite'] });
  const r = rankEvents(
    [ev({ category: 'Consulting', title: 'Case Night', location: 'München', format: 'onsite', start_date: '2026-11-08T18:00' })],
    p,
    { today: TODAY },
  );
  assert.deepEqual(r.top[0].reasons, ['Kategorie Consulting', '„case“ im Titel', 'in München']);
});

test('Zeitnähe-Grund erscheint, wenn Platz ist', () => {
  const p = profile({ categories: ['Consulting'] });
  const r = rankEvents([ev({ category: 'Consulting', start_date: '2026-11-08T18:00' })], p, { today: TODAY });
  assert.deepEqual(r.top[0].reasons, ['Kategorie Consulting', 'morgen']);
});
