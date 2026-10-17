const { MAX_PAGES_LIMIT } = require('../db/sourcesRepo');

// Prüft die Blätter-Einstellungen einer Quelle (rein, ohne DB-Zugriff).
// `data` sind die gesendeten Felder, `existing` die bisherige Quelle (bei
// einer Änderung), damit auch Teil-Updates richtig bewertet werden: gilt ein
// Feld nicht in `data`, zählt der bisherige Wert.
function validateSourcePagination(data, existing = {}) {
  const errors = [];
  const pick = (field) => (data[field] !== undefined ? data[field] : existing[field]);

  const renderJs = !!pick('render_js');
  const nextSelector = (pick('next_selector') || '').toString().trim();
  const rawMax = pick('max_pages');
  const maxPages = rawMax === undefined || rawMax === null || rawMax === '' ? 1 : Number(rawMax);

  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > MAX_PAGES_LIMIT) {
    errors.push(`Max. Seiten muss eine ganze Zahl von 1 bis ${MAX_PAGES_LIMIT} sein`);
  } else {
    if (maxPages > 1 && !nextSelector) {
      errors.push('Für mehr als eine Seite wird ein Nächste-Seite-Selektor benötigt');
    }
    if (nextSelector && !renderJs) {
      errors.push('Blättern funktioniert nur mit aktiviertem Browser-Rendering (JavaScript-Häkchen)');
    }
  }
  return errors;
}

module.exports = { validateSourcePagination };
