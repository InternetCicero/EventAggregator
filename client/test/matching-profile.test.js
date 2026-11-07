// Profil im Browser-Speicher (Spec 2026-11-07-fuer-dich, AC-5 bis AC-9, AC-12)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  emptyProfile,
  sanitizeProfile,
  loadProfile,
  saveProfile,
  clearProfile,
  isActive,
  cycleCategory,
} from '../src/lib/matching/profile.js';

const CATEGORIES = ['Consulting', 'Networking', 'Hackathon'];

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const throwingStorage = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
  removeItem() {
    throw new Error('SecurityError');
  },
};

test('AC-5: speichern und nach dem Neuladen wiederherstellen', () => {
  const storage = memoryStorage();
  const saved = saveProfile(storage, { ...emptyProfile(), categories: ['Consulting'], keywords: ['case'] }, { today: '2026-11-07' });
  assert.equal(saved.updatedAt, '2026-11-07');
  const stored = JSON.parse(storage.data[STORAGE_KEY]);
  assert.equal(stored.version, 1);
  const loaded = loadProfile(storage);
  assert.deepEqual(loaded.categories, ['Consulting']);
  assert.deepEqual(loaded.keywords, ['case']);
});

test('AC-6: fehlender, kaputter, fremder Wert oder gesperrter Speicher -> leeres Profil', () => {
  assert.deepEqual(loadProfile(memoryStorage()), emptyProfile());
  assert.deepEqual(loadProfile(memoryStorage({ [STORAGE_KEY]: '{kaputt' })), emptyProfile());
  assert.deepEqual(loadProfile(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 99, keywords: ['x'] }) })), emptyProfile());
  assert.deepEqual(loadProfile(throwingStorage), emptyProfile());
  assert.deepEqual(loadProfile(undefined), emptyProfile());
  assert.equal(saveProfile(throwingStorage, emptyProfile()), false);
  assert.equal(clearProfile(throwingStorage), false);
});

test('AC-7: unbekannte Kategorien, zu viele und zu lange Schlagwörter, lange Städte', () => {
  const p = sanitizeProfile(
    {
      categories: ['Consulting', 'Gibts nicht', 'Consulting'],
      keywords: [...Array.from({ length: 20 }, (_, i) => `wort${i}`), 'x'.repeat(50)],
      cities: { primary: `  ${'M'.repeat(80)}  `, secondary: 'Berlin' },
      formats: ['online', 'teleport'],
      horizonDays: 45,
    },
    { categories: CATEGORIES },
  );
  assert.deepEqual(p.categories, ['Consulting']);
  assert.equal(p.keywords.length, 15);
  assert.equal(p.cities.primary.length, 60);
  assert.deepEqual(p.formats, ['online']);
  assert.equal(p.horizonDays, 60);
});

test('AC-7: Schlagwort-Duplikate unabhängig von Schreibweise, Leerzeichen bereinigt', () => {
  const p = sanitizeProfile({ keywords: ['Case', ' case ', 'CASE', 'M&A', 'm & a', '   ', 'Private   Equity'] });
  assert.deepEqual(p.keywords, ['Case', 'M&A', 'Private Equity']);
});

test('AC-8: Kategorie wechselt neutral -> interessiert -> nicht interessiert -> neutral', () => {
  let p = emptyProfile();
  p = cycleCategory(p, 'Consulting');
  assert.deepEqual([p.categories, p.excludedCategories], [['Consulting'], []]);
  p = cycleCategory(p, 'Consulting');
  assert.deepEqual([p.categories, p.excludedCategories], [[], ['Consulting']]);
  p = cycleCategory(p, 'Consulting');
  assert.deepEqual([p.categories, p.excludedCategories], [[], []]);
});

test('AC-8: steht eine Kategorie in beiden Listen, gewinnt "interessiert"', () => {
  const p = sanitizeProfile({ categories: ['Consulting'], excludedCategories: ['Consulting', 'Hackathon'] });
  assert.deepEqual(p.excludedCategories, ['Hackathon']);
});

test('AC-9: Löschen entfernt den Schlüssel', () => {
  const storage = memoryStorage();
  saveProfile(storage, { ...emptyProfile(), keywords: ['case'] });
  assert.equal(clearProfile(storage), true);
  assert.equal(STORAGE_KEY in storage.data, false);
  assert.deepEqual(loadProfile(storage), emptyProfile());
});

test('AC-12: aktiv erst mit Kategorie, Schlagwort oder Hauptstadt', () => {
  assert.equal(isActive(emptyProfile()), false);
  assert.equal(isActive({ ...emptyProfile(), formats: ['online'], horizonDays: 30 }), false);
  assert.equal(isActive({ ...emptyProfile(), excludedCategories: ['Hackathon'] }), false);
  assert.equal(isActive({ ...emptyProfile(), categories: ['Consulting'] }), true);
  assert.equal(isActive({ ...emptyProfile(), keywords: ['case'] }), true);
  assert.equal(isActive({ ...emptyProfile(), cities: { primary: 'Berlin', secondary: '' } }), true);
});
