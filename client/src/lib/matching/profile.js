// Interessenprofil für "Für dich". Liegt nur im localStorage des Browsers und
// wird nie an den Server geschickt. storage wird übergeben, damit sich alles
// ohne Browser testen lässt.
import { fold } from './normalize.js';

export const STORAGE_KEY = 'studenthub.profile';
export const PROFILE_VERSION = 1;
export const HORIZONS = [30, 60, 90];
export const FORMATS = ['online', 'onsite', 'hybrid'];

const MAX_KEYWORDS = 15;
const MAX_KEYWORD_LENGTH = 40;
const MAX_CITY_LENGTH = 60;

export function emptyProfile() {
  return {
    version: PROFILE_VERSION,
    categories: [],
    excludedCategories: [],
    keywords: [],
    cities: { primary: '', secondary: '' },
    acceptOnline: true,
    formats: [],
    horizonDays: 60,
    updatedAt: null,
  };
}

function uniqueStrings(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter((v) => typeof v === 'string' && v.trim()))];
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// Bereinigt ein Profil (AC-7, AC-8). categories: die gültigen Kategorien; ohne
// Angabe wird nicht nach Kategorie gefiltert.
export function sanitizeProfile(raw, { categories } = {}) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const known = categories ? new Set(categories) : null;
  const keep = (c) => !known || known.has(c);

  const interested = uniqueStrings(p.categories).filter(keep);
  const excluded = uniqueStrings(p.excludedCategories)
    .filter(keep)
    .filter((c) => !interested.includes(c));

  const seen = new Set();
  const keywords = [];
  for (const k of Array.isArray(p.keywords) ? p.keywords : []) {
    const text = cleanText(k, MAX_KEYWORD_LENGTH);
    const key = fold(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keywords.push(text);
    if (keywords.length === MAX_KEYWORDS) break;
  }

  const cities = p.cities && typeof p.cities === 'object' ? p.cities : {};
  return {
    version: PROFILE_VERSION,
    categories: interested,
    excludedCategories: excluded,
    keywords,
    cities: {
      primary: cleanText(cities.primary, MAX_CITY_LENGTH),
      secondary: cleanText(cities.secondary, MAX_CITY_LENGTH),
    },
    acceptOnline: p.acceptOnline !== false,
    formats: uniqueStrings(p.formats).filter((f) => FORMATS.includes(f)),
    horizonDays: HORIZONS.includes(Number(p.horizonDays)) ? Number(p.horizonDays) : 60,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : null,
  };
}

// Erst mit Kategorie, Schlagwort oder Hauptstadt gibt es Empfehlungen (AC-12)
export function isActive(profile) {
  return Boolean(profile && (profile.categories.length || profile.keywords.length || profile.cities.primary));
}

// AC-5, AC-6: fehlender, kaputter oder unzugänglicher Speicher -> leeres Profil
export function loadProfile(storage, options) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== PROFILE_VERSION) return emptyProfile();
    return sanitizeProfile(parsed, options);
  } catch {
    return emptyProfile();
  }
}

// Gibt das gespeicherte Profil zurück; false, wenn der Speicher nicht geht
export function saveProfile(storage, profile, { today, ...options } = {}) {
  const clean = { ...sanitizeProfile(profile, options), updatedAt: today || new Date().toISOString().slice(0, 10) };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return clean;
  } catch {
    return false;
  }
}

export function clearProfile(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

// Ein Klick auf eine Kategorie: neutral -> interessiert -> nicht interessiert -> neutral.
// Eine Kategorie steht so nie in beiden Listen (AC-8).
export function cycleCategory(profile, category) {
  const interested = profile.categories.includes(category);
  const excluded = profile.excludedCategories.includes(category);
  const without = (list) => list.filter((c) => c !== category);
  if (interested) {
    return { ...profile, categories: without(profile.categories), excludedCategories: [...profile.excludedCategories, category] };
  }
  if (excluded) return { ...profile, excludedCategories: without(profile.excludedCategories) };
  return { ...profile, categories: [...profile.categories, category] };
}
