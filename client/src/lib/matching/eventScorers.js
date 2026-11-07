// Teilbewertungen und Ausschlussregeln für Events (Spec 6.3). Jede
// Teilbewertung liefert null (nicht anwendbar, weil das Profilfeld leer ist)
// oder { points, max, reason }. Die Reihenfolge der Liste ist zugleich die
// Reihenfolge der Begründungen (AC-19).
import { containsPhrase, matchesCity } from './normalize.js';
import { dayOf, daysBetween } from './dates.js';
import { HIT, WEIGHTS } from './weights.js';

const FORMAT_LABELS = { online: 'Online', onsite: 'Vor Ort', hybrid: 'Hybrid' };

function categoryScorer(event, profile) {
  if (!profile.categories.length) return null;
  const hit = profile.categories.includes(event.category);
  return { points: hit ? WEIGHTS.category : 0, max: WEIGHTS.category, reason: hit ? `Kategorie ${event.category}` : null };
}

// Trefferstärke eines Schlagworts: Tag oder Titel = stark, Beschreibung = schwach
function keywordHit(event, keyword) {
  if ((event.tags || []).some((t) => containsPhrase(t, keyword))) return { strength: HIT.keywordStrong, where: 'als Tag' };
  if (containsPhrase(event.title, keyword)) return { strength: HIT.keywordStrong, where: 'im Titel' };
  if (containsPhrase(event.description, keyword)) return { strength: HIT.keywordWeak, where: 'in der Beschreibung' };
  return null;
}

function keywordScorer(event, profile) {
  if (!profile.keywords.length) return null;
  let total = 0;
  let best = null;
  for (const keyword of profile.keywords) {
    const hit = keywordHit(event, keyword);
    if (!hit) continue;
    total += hit.strength;
    if (!best || hit.strength > best.strength) best = { ...hit, keyword };
  }
  return {
    points: WEIGHTS.keyword * Math.min(1, total),
    max: WEIGHTS.keyword,
    reason: best ? `„${best.keyword}“ ${best.where}` : null,
  };
}

// Ort zählt nur, wenn eine Stadt angegeben ist; "Online okay" verändert
// dann nur die Wertung von Online- und Hybrid-Events.
function locationScorer(event, profile) {
  const { primary, secondary } = profile.cities;
  if (!primary && !secondary) return null;
  const options = [];
  if (event.format !== 'online') {
    if (matchesCity(event.location, primary)) options.push({ share: HIT.primaryCity, reason: `in ${primary}` });
    else if (matchesCity(event.location, secondary)) options.push({ share: HIT.secondaryCity, reason: `in ${secondary}` });
  }
  if (profile.acceptOnline && (event.format === 'online' || event.format === 'hybrid')) {
    options.push({ share: HIT.online, reason: event.format === 'online' ? 'online' : 'auch online' });
  }
  const best = options.sort((a, b) => b.share - a.share)[0];
  return { points: best ? WEIGHTS.location * best.share : 0, max: WEIGHTS.location, reason: best ? best.reason : null };
}

function formatScorer(event, profile) {
  if (!profile.formats.length) return null;
  if (!event.format) return { points: WEIGHTS.format * HIT.unknownFormat, max: WEIGHTS.format, reason: null };
  const hit = profile.formats.includes(event.format);
  return { points: hit ? WEIGHTS.format : 0, max: WEIGHTS.format, reason: hit ? `Format ${FORMAT_LABELS[event.format]}` : null };
}

function timeScorer(event, profile, { today }) {
  const days = Math.max(0, daysBetween(today, dayOf(event.start_date)));
  const running = dayOf(event.start_date) < today;
  const share = running ? 1 : Math.max(0, 1 - days / profile.horizonDays);
  let reason;
  if (running) reason = 'läuft gerade';
  else if (days === 0) reason = 'heute';
  else if (days === 1) reason = 'morgen';
  else reason = `in ${days} Tagen`;
  return { points: WEIGHTS.time * share, max: WEIGHTS.time, reason };
}

export const EVENT_SCORERS = [categoryScorer, keywordScorer, locationScorer, formatScorer, timeScorer];

// AC-13: ausgeschlossene Kategorie, schon vorbei, oder jenseits des Zeitraums
export function excludeEvent(event, profile, { today }) {
  if (profile.excludedCategories.includes(event.category)) return true;
  const start = dayOf(event.start_date);
  const end = dayOf(event.end_date) || start;
  if (!start || end < today) return true;
  return daysBetween(today, start) > profile.horizonDays;
}
