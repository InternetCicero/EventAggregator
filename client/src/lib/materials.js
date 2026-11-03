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
