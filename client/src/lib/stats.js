// Besucherstatistik ohne Cookies und ohne Browser-Speicher (Spec 2026-11-03-site-analytics).
// Meldet Seitenaufruf und alle 15 s einen Ping, solange die Seite sichtbar ist.
// Fehler werden bewusst verschluckt: die Statistik darf die Seite nie beeinträchtigen.

export const PING_INTERVAL_MS = 15000;

export function trackingAllowed(nav) {
  if (!nav) return false;
  return nav.doNotTrack !== '1' && nav.globalPrivacyControl !== true;
}

export function isTrackedPath(pathname) {
  return !pathname.startsWith('/admin');
}

// Alle Abhängigkeiten sind austauschbar, damit sich die Logik ohne Browser testen lässt.
export function createTracker({ send, beacon, isVisible, setTimer, clearTimer }) {
  let idPromise = null;
  let timer = null;

  function ping(useBeacon) {
    if (!idPromise) return;
    idPromise.then((id) => {
      if (!id) return;
      if (useBeacon) beacon('/api/stats/ping', { id });
      else send('/api/stats/ping', { id });
    });
  }

  function startTimer() {
    if (timer !== null || !idPromise) return;
    timer = setTimer(() => ping(false), PING_INTERVAL_MS);
  }

  function stopTimer() {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  }

  return {
    view(path) {
      this.stop();
      idPromise = send('/api/stats/view', { path, wantId: true }).catch(() => null);
      if (isVisible()) startTimer();
    },
    // Tab verlassen oder in den Hintergrund: letzter Ping, Timer aus
    hidden() {
      stopTimer();
      ping(true);
    },
    visible() {
      if (!idPromise) return;
      ping(false);
      startTimer();
    },
    stop() {
      if (idPromise) ping(true);
      stopTimer();
      idPromise = null;
    },
  };
}

async function post(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (body.wantId && res.status === 200) return (await res.json()).id;
  } catch {
    // ignorieren
  }
  return null;
}

export function browserTracker() {
  return createTracker({
    send: post,
    beacon: (url, body) => {
      try {
        const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
        if (!navigator.sendBeacon || !navigator.sendBeacon(url, blob)) post(url, body);
      } catch {
        // ignorieren
      }
    },
    isVisible: () => document.visibilityState === 'visible',
    setTimer: (fn, ms) => setInterval(fn, ms),
    clearTimer: (t) => clearInterval(t),
  });
}
