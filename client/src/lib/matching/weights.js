// Gewichte und Schwellen der Event-Empfehlungen (Spec 2026-11-07-fuer-dich, 6.3).
// Alle Stellschrauben an einem Ort, damit sie sich leicht nachjustieren lassen.
export const WEIGHTS = {
  category: 40,
  keyword: 25,
  location: 20,
  format: 10,
  time: 5,
};

export const HIT = {
  keywordStrong: 1, // Treffer in Tag oder Titel
  keywordWeak: 0.6, // Treffer nur in der Beschreibung
  primaryCity: 1,
  secondaryCity: 0.7,
  online: 0.8,
  unknownFormat: 0.5,
};

export const THRESHOLDS = { top: 60, maybe: 30 };

// Abzug pro bereits einsortiertem Event derselben Quelle (nur für die Reihenfolge)
export const DIVERSITY_FACTOR = 0.9;

export const MAX_REASONS = 3;
