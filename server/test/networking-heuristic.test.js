const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applyNetworkingHeuristic, resolveUrl } = require('../src/scraper/runSource');

test('applyNetworkingHeuristic: erkennt Afterwork-Titel und hebt Kategorie+Tag', () => {
  const result = applyNetworkingHeuristic('Afterwork with HHL | Berlin', 'Bildung & Vortrag', ['hhl']);
  assert.equal(result.category, 'Business & Networking');
  assert.deepEqual(result.tags, ['hhl', 'networking']);
});

test('applyNetworkingHeuristic: erkennt weitere Schlüsselwörter (Meetup, Netzwerkabend, Mixer)', () => {
  assert.equal(applyNetworkingHeuristic('Tech Meetup München', 'X', []).category, 'Business & Networking');
  assert.equal(applyNetworkingHeuristic('Netzwerkabend für Gründer:innen', 'X', []).category, 'Business & Networking');
  assert.equal(applyNetworkingHeuristic('Investor Mixer', 'X', []).category, 'Business & Networking');
});

test('applyNetworkingHeuristic: lässt unbeteiligte Titel unverändert', () => {
  const tags = ['hhl', 'studium'];
  const result = applyNetworkingHeuristic('Leipzig Leadership Lecture mit Christian Lindner', 'Bildung & Vortrag', tags);
  assert.equal(result.category, 'Bildung & Vortrag');
  assert.equal(result.tags, tags); // unverändertes Array zurückgegeben, keine Kopie nötig
});

test('applyNetworkingHeuristic: vergibt den Tag nicht doppelt, wenn er schon gesetzt ist', () => {
  const result = applyNetworkingHeuristic('Afterwork with HHL', 'X', ['networking']);
  assert.deepEqual(result.tags, ['networking']);
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
