// Duplikaterkennung für Events über mehrere Quellen (rein regelbasiert, kein
// KI-Einsatz). Zwei Events sind Kandidaten, wenn sie am selben Kalendertag
// liegen und ihre Titel nach Normalisierung ähnlich sind. Bewusst ohne
// Datenbankzugriff, damit sowohl das Speichern (eventsRepo) als auch die
// Migration (db/index.js) dieselben Regeln nutzen können.

// Ab STRONG gilt ein Event als dasselbe Event, ab WEAK als mögliches Duplikat.
const STRONG = 0.9;
const WEAK = 0.6;

const STOPWORDS = new Set([
  'mit', 'bei', 'von', 'der', 'die', 'das', 'und', 'the', 'at', 'with', 'by', 'and',
  'in', 'im', 'am', 'x', 'an', 'auf', 'fur', 'for', 'of', 'to', 'zu', 'zum', 'zur',
]);

function tokenize(text, { dropStopwords }) {
  const tokens = String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // Akzente und Umlautpunkte: ä -> a, é -> e
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((t) => !/^(19|20)\d{2}$/.test(t)); // Jahreszahlen sind kein Unterscheidungsmerkmal
  return new Set(dropStopwords ? tokens.filter((t) => !STOPWORDS.has(t)) : tokens);
}

function normalizeTitle(title) {
  return [...tokenize(title, { dropStopwords: true })];
}

// Jaccard: gemeinsame Wörter / alle Wörter beider Titel (0 bis 1).
function titleSimilarity(a, b) {
  const sa = new Set(normalizeTitle(a));
  const sb = new Set(normalizeTitle(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let common = 0;
  for (const t of sa) if (sb.has(t)) common++;
  return common / (sa.size + sb.size - common);
}

// Datumsteil (YYYY-MM-DD) oder null, wenn kein Datum erkennbar ist.
function dayOf(startDate) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(startDate || ''));
  return m ? m[1] : null;
}

// Haben beide einen Ort und teilen sie kein Wort, sind es verschiedene Events
// ("Berlin" vs. "Berlin, Germany" passt, "Online" vs. "München" nicht).
function locationsConflict(a, b) {
  const la = tokenize(a, { dropStopwords: false });
  const lb = tokenize(b, { dropStopwords: false });
  if (la.size === 0 || lb.size === 0) return false;
  for (const t of la) if (lb.has(t)) return false;
  return true;
}

// Vergleicht zwei Events und liefert { level: 'duplicate' | 'possible', similarity }
// oder null. Erwartet Objekte mit title, start_date und optional location.
function classifyPair(a, b) {
  const dayA = dayOf(a.start_date);
  if (!dayA || dayA !== dayOf(b.start_date)) return null;
  if (locationsConflict(a.location, b.location)) return null;
  const similarity = titleSimilarity(a.title, b.title);
  if (similarity >= STRONG) return { level: 'duplicate', similarity };
  if (similarity >= WEAK) return { level: 'possible', similarity };
  return null;
}

module.exports = { STRONG, WEAK, normalizeTitle, titleSimilarity, dayOf, locationsConflict, classifyPair };
