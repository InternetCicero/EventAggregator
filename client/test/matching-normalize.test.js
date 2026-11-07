// Textvergleich fürs Matching (Spec 2026-11-07-fuer-dich, AC-15)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, containsPhrase, matchesCity } from '../src/lib/matching/normalize.js';

test('fold: Kleinschreibung, Umlaute, Akzente, Satzzeichen', () => {
  assert.equal(fold('Zürich, M&A-Workshop!'), 'zuerich m a workshop');
  assert.equal(fold('Café Größe'), 'cafe groesse');
});

test('AC-15: nur ganze Wörter, kein Teilwort', () => {
  assert.equal(containsPhrase('Keynote mit dem CEO', 'EY'), false);
  assert.equal(containsPhrase('Recruiting-Abend bei EY', 'ey'), true);
});

test('AC-15: Umlaute und Schreibweisen gelten als gleich', () => {
  assert.equal(containsPhrase('Workshop in Muenchen', 'München'), true);
  assert.equal(containsPhrase('Case Study Training', 'case study'), true);
  assert.equal(containsPhrase('Showcase', 'case'), false);
});

test('leeres Suchwort trifft nie', () => {
  assert.equal(containsPhrase('alles', '  '), false);
});

test('Städte: Aliasse und Teilangaben im Freitext', () => {
  assert.equal(matchesCity('Munich, Germany', 'München'), true);
  assert.equal(matchesCity('Frankfurt am Main und Düsseldorf', 'Frankfurt'), true);
  assert.equal(matchesCity('Frankfurt am Main und Düsseldorf', 'Duesseldorf'), true);
  assert.equal(matchesCity('Berlin', 'München'), false);
  assert.equal(matchesCity(null, 'München'), false);
});
