// Allgemeine Empfehlungs-Rechnung (Spec 6.3): Ausschluss -> Teilbewertungen ->
// normalisierter Score -> Reihenfolge mit Vielfaltsabzug -> Gruppen.
// Reine Funktion ohne Browser-Abhängigkeiten.
import { isActive } from './profile.js';
import { DIVERSITY_FACTOR, MAX_REASONS, THRESHOLDS } from './weights.js';

function scoreItem(item, profile, scorers, ctx) {
  let points = 0;
  let max = 0;
  const reasons = [];
  for (const scorer of scorers) {
    const r = scorer(item, profile, ctx);
    if (!r) continue;
    points += r.points;
    max += r.max;
    if (r.points > 0 && r.reason) reasons.push(r.reason);
  }
  const raw = max > 0 ? (points / max) * 100 : 0;
  return { item, raw, score: Math.round(raw), reasons: reasons.slice(0, MAX_REASONS) };
}

function compare(a, b, adjustedA, adjustedB) {
  if (Math.abs(adjustedA - adjustedB) > 1e-9) return adjustedB - adjustedA;
  const startA = a.item.start_date || '';
  const startB = b.item.start_date || '';
  if (startA !== startB) return startA < startB ? -1 : 1;
  return (a.item.id ?? 0) - (b.item.id ?? 0);
}

// Gierige Auswahl: jedes weitere Event derselben Quelle zählt mit
// score * 0.9^n, n = bereits einsortierte Events dieser Quelle (AC-17)
function orderWithDiversity(results, sourceOf) {
  const remaining = [...results];
  const perSource = new Map();
  const ordered = [];
  const adjusted = (r) => r.raw * DIVERSITY_FACTOR ** (perSource.get(sourceOf(r.item)) || 0);
  while (remaining.length) {
    let bestIndex = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (compare(remaining[i], remaining[bestIndex], adjusted(remaining[i]), adjusted(remaining[bestIndex])) < 0) {
        bestIndex = i;
      }
    }
    const [best] = remaining.splice(bestIndex, 1);
    const source = sourceOf(best.item);
    perSource.set(source, (perSource.get(source) || 0) + 1);
    ordered.push(best);
  }
  return ordered;
}

function groupOf(score) {
  if (score >= THRESHOLDS.top) return 'top';
  if (score >= THRESHOLDS.maybe) return 'maybe';
  return null;
}

// Liefert { top, maybe, otherCount }. Ohne aktives Profil alles leer (AC-12).
export function rank(items, profile, { scorers, exclude, today, sourceOf = (i) => i.source }) {
  if (!isActive(profile)) return { top: [], maybe: [], otherCount: 0 };
  const ctx = { today };
  const scored = items.filter((i) => !exclude(i, profile, ctx)).map((i) => scoreItem(i, profile, scorers, ctx));
  const ordered = orderWithDiversity(scored, sourceOf).map((r) => ({ ...r, group: groupOf(r.score) }));
  return {
    top: ordered.filter((r) => r.group === 'top'),
    maybe: ordered.filter((r) => r.group === 'maybe'),
    otherCount: ordered.filter((r) => r.group === null).length,
  };
}
