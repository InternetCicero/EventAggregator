// Textvergleich für das Matching: Groß-/Kleinschreibung, Umlaute und
// Satzzeichen spielen keine Rolle, Treffer zählen nur als ganze Wörter
// (damit z. B. "EY" nicht in "Keynote" gefunden wird).

const UMLAUTS = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

export function fold(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// needle kommt als ganzes Wort bzw. ganze Wortfolge in haystack vor
export function containsPhrase(haystack, needle) {
  const n = fold(needle);
  if (!n) return false;
  return ` ${fold(haystack)} `.includes(` ${n} `);
}

// Häufige Städte mit deutscher und englischer Schreibweise
const CITY_ALIASES = [
  ['muenchen', 'munich'],
  ['koeln', 'cologne'],
  ['wien', 'vienna'],
  ['zuerich', 'zurich'],
  ['nuernberg', 'nuremberg'],
];

export function matchesCity(location, city) {
  const c = fold(city);
  if (!c || !location) return false;
  const variants = CITY_ALIASES.find((group) => group.includes(c)) || [c];
  return variants.some((v) => containsPhrase(location, v));
}
