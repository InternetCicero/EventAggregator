// Grobe Gerätekategorie aus der Browserkennung. Nur die Kategorie wird gespeichert,
// die Browserkennung selbst nie (Spec 2026-11-16-statistik-dashboard, Phase 2).

const DEVICES = ['mobile', 'tablet', 'desktop', 'other'];

function deviceClass(userAgent) {
  const ua = String(userAgent || '');
  if (/ipad|tablet|playbook|silk|kindle/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return 'tablet';
  if (/iphone|ipod|mobi|windows phone/i.test(ua)) return 'mobile';
  if (/windows nt|macintosh|mac os x|x11|linux|cros/i.test(ua)) return 'desktop';
  return 'other';
}

module.exports = { deviceClass, DEVICES };
