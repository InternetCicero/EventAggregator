// Pfad-Normalisierung und Bot-Erkennung für die Besucherstatistik.
// Nur bekannte Routen der Seite werden gezählt; alles andere wird verworfen.

const STATIC_PATHS = new Set([
  '/',
  '/einreichen',
  '/jobs',
  '/jobs/einreichen',
  '/materialien',
  '/datenschutz',
  '/impressum',
]);

function normalizePath(raw) {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  let p = raw.split('#')[0].split('?')[0];
  if (!p.startsWith('/')) return null;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (STATIC_PATHS.has(p)) return p;
  if (/^\/materialien\/[a-z0-9-]+$/.test(p)) return '/materialien/:id';
  if (/^\/jobs\/\d+$/.test(p)) return '/jobs/:id';
  return null;
}

const BOT_PATTERN = /bot|crawl|spider|slurp|headless|curl|wget|python|java\/|go-http|monitor|preview|facebookexternalhit|lighthouse/i;

function isBot(userAgent) {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

module.exports = { normalizePath, isBot };
