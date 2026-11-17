import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  percentChange,
  formatChange,
  formatInt,
  formatDecimal,
  formatDuration,
  formatCompact,
  rangeQuery,
  availabilityNote,
  peakHour,
  percentOf,
  isWeekend,
  shortLabel,
  fullLabel,
  niceMax,
  labelEvery,
  groupShares,
} from '../src/lib/statsMath.js';

test('percentChange: Vergleich nur bei ausreichend großer Vorperiode (AC-4)', () => {
  assert.equal(percentChange(118, 100, 50), 18);
  assert.equal(percentChange(50, 100, 50), -50);
  assert.equal(percentChange(10, 0, 50), null); // Division durch null
  assert.equal(percentChange(10, 5, 9), null); // unter 10 Besuchern kein Vergleich
  assert.equal(percentChange(0, 100, 50), -100);
});

test('formatChange: Vorzeichen und Platzhalter', () => {
  assert.equal(formatChange(18), '+18 %');
  assert.equal(formatChange(-6), '−6 %');
  assert.equal(formatChange(0), '±0 %');
  assert.equal(formatChange(null), 'kein Vergleich');
  assert.equal(formatChange(101355), '+101.355 %');
});

test('Zahlen im deutschen Format', () => {
  assert.equal(formatInt(1234567), '1.234.567');
  assert.equal(formatDecimal(2.4), '2,4');
  assert.equal(formatDecimal(3), '3');
  assert.equal(formatDuration(0), '–');
  assert.equal(formatDuration(72), '1 Min 12 s');
  assert.equal(formatDuration(45), '45 s');
});

test('Datumsbeschriftung und Wochenende', () => {
  assert.equal(shortLabel('2026-11-09'), '9.11.');
  assert.equal(shortLabel('2026-11'), 'Nov 26');
  assert.equal(fullLabel('2026-11-09'), 'Mo, 09.11.2026');
  assert.equal(isWeekend('2026-11-07'), true); // Samstag
  assert.equal(isWeekend('2026-11-08'), true); // Sonntag
  assert.equal(isWeekend('2026-11-09'), false);
});

test('niceMax rundet auf 1, 2, 5 mal Zehnerpotenz', () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(18), 20);
  assert.equal(niceMax(41), 50);
  assert.equal(niceMax(58), 100);
  assert.equal(niceMax(1234567), 2000000);
});

test('labelEvery begrenzt die Zahl der Achsenbeschriftungen', () => {
  assert.equal(labelEvery(7), 1);
  assert.equal(labelEvery(30), 3);
  assert.equal(labelEvery(90), 9);
});

test('groupShares ergibt 100 Prozent und behandelt leere Daten (AC-5)', () => {
  const g = groupShares([
    { key: 'events', views: 1 },
    { key: 'jobs', views: 1 },
    { key: 'materialien', views: 1 },
  ]);
  assert.equal(g.reduce((a, x) => a + x.percent, 0), 100);
  const empty = groupShares([{ key: 'events', views: 0 }]);
  assert.equal(empty[0].percent, 0);
});

test('formatCompact und rangeQuery', () => {
  assert.equal(formatCompact(999), '999');
  assert.equal(formatCompact(1234), '1,2k');
  assert.equal(formatCompact(2500000), '2,5M');
  assert.equal(rangeQuery({ kind: 'days', days: 30 }), 'days=30');
  assert.equal(rangeQuery({ kind: '12m' }), 'range=12m');
  assert.equal(rangeQuery({ kind: 'custom', from: '2026-01-01', to: '2026-01-31' }), 'from=2026-01-01&to=2026-01-31');
});

test('availabilityNote: Hinweis je nach Datenlage (AC-12)', () => {
  assert.match(availabilityNote(null, '2026-11-01', false), /Noch keine Daten/);
  assert.match(availabilityNote('2026-11-20', '2026-11-01', false), /noch keine Daten \(erfasst ab 20\.11\.\)/);
  assert.match(availabilityNote('2026-11-05', '2026-11-01', true), /erst ab 5\.11\. verfügbar/);
  assert.equal(availabilityNote('2026-11-01', '2026-11-05', true), null);
});

test('peakHour und percentOf', () => {
  assert.equal(peakHour(Array(24).fill(0)), null);
  const h = Array(24).fill(0);
  h[18] = 5;
  h[9] = 3;
  assert.equal(peakHour(h), 18);
  assert.equal(percentOf(1, 3), 33);
  assert.equal(percentOf(0, 0), 0);
});
