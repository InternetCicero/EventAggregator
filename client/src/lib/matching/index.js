// Einstiegspunkt: Event-Empfehlungen mit den Standard-Teilbewertungen
import { rank } from './rank.js';
import { EVENT_SCORERS, excludeEvent } from './eventScorers.js';

export function rankEvents(events, profile, { today }) {
  return rank(events, profile, { scorers: EVENT_SCORERS, exclude: excludeEvent, today });
}
