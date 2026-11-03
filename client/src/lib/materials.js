import data from '../data/materials.json';

export const MATERIALS = data;

const BASE = '/materialien/';
export const fileUrl = (file) => BASE + encodeURIComponent(file);

// Reihenfolge der Format-Filter und Badge-Namen.
export const FORMATS = [
  ['prompt', 'Prompt'],
  ['text', 'Text'],
  ['datei', 'Datei'],
  ['bild', 'Bild'],
  ['link', 'Link'],
];
export const FORMAT_LABEL = Object.fromEntries(FORMATS);

export function findMaterial(id) {
  return data.items.find((m) => m.id === id);
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Lizenzhinweis für eigene Materialien; Materialien mit eigener Lizenz stehen in OTHER_LICENSE.
export const LICENSE_NOTICE =
  'Eigene Materialien von Laurenz Polanski, Lizenz CC BY-NC 4.0: kostenlos nutzbar, auch im Beruf, anpassbar und nicht-kommerziell weitergebbar, mit Namensnennung. Verkauf oder kommerzielle Weitergabe ist nicht erlaubt.';
export const OTHER_LICENSE = ['quantitative-analysis-skill'];
