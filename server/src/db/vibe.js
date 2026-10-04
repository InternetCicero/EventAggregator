// "Vibe" einer Stelle: Schieberegler zwischen zwei Polen (Skala 1–5, alle
// Pflicht) und kurze Leitfragen (optional, max. 280 Zeichen). Bewusst feste
// Listen statt Freitext, damit die Angaben vergleichbar bleiben und in v3
// für ein regelbasiertes Matching taugen.
const dimensions = [
  { key: 'structure', left: 'Klare Prozesse, Konzernstruktur', right: 'Startup, vieles im Aufbau' },
  { key: 'guidance', left: 'Enge Betreuung', right: 'Eigenverantwortung ab Tag 1' },
  { key: 'language', left: 'Deutsch im Alltag', right: 'Englisch im Alltag' },
  { key: 'location', left: 'Fester Arbeitsplatz im Büro', right: 'Vollständig remote' },
  { key: 'intensity', left: 'Planbare Arbeitszeiten', right: 'Intensive Phasen, viel Einsatz' },
  { key: 'teams', left: 'Teams nach Funktion getrennt', right: 'Interdisziplinär gemischt' },
  { key: 'social', left: 'Feierabend ist Feierabend', right: 'Viele Team-Events und After-Work' },
];

const questions = [
  { key: 'week2', label: 'Was macht man konkret in Woche 2?' },
  { key: 'last_project', label: 'Was war das letzte Projekt, das ein Praktikant/Junior präsentiert hat?' },
  { key: 'not_for', label: 'Für wen ist diese Stelle nichts?' },
  { key: 'retention', label: 'Wie viele der letzten Praktikanten wurden übernommen?' },
  { key: 'process', label: 'Wie läuft der Bewerbungsprozess ab und wie lange dauert er?' },
];

const ANSWER_MAX_LENGTH = 280;
const REFERRER_NOTE_MAX_LENGTH = 400;

module.exports = { dimensions, questions, ANSWER_MAX_LENGTH, REFERRER_NOTE_MAX_LENGTH };
