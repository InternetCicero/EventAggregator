import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTracker, isTrackedPath, trackingAllowed, PING_INTERVAL_MS } from '../src/lib/stats.js';

function setup({ visible = true } = {}) {
  const calls = [];
  let tick = null;
  let state = { visible };
  const tracker = createTracker({
    send: async (url, body) => {
      calls.push(['send', url, body]);
      return url.endsWith('view') ? 'abc123' : null;
    },
    beacon: (url, body) => calls.push(['beacon', url, body]),
    isVisible: () => state.visible,
    setTimer: (fn, ms) => {
      assert.equal(ms, PING_INTERVAL_MS);
      tick = fn;
      return 1;
    },
    clearTimer: () => {
      tick = null;
    },
  });
  return { tracker, calls, state, fire: () => tick && tick(), hasTimer: () => tick !== null };
}
const flush = () => new Promise((r) => setImmediate(r));

test('Pfade im Admin-Bereich werden nicht gemeldet', () => {
  assert.equal(isTrackedPath('/admin'), false);
  assert.equal(isTrackedPath('/materialien'), true);
});

test('Do Not Track und Global Privacy Control schalten die Messung ab (AC-8)', () => {
  assert.equal(trackingAllowed({ doNotTrack: '1' }), false);
  assert.equal(trackingAllowed({ globalPrivacyControl: true }), false);
  assert.equal(trackingAllowed({ doNotTrack: null }), true);
});

test('sichtbare Seite: Aufruf, dann Ping im Takt (AC-5)', async () => {
  const t = setup();
  t.tracker.view('/materialien');
  await flush();
  t.fire();
  await flush();
  assert.deepEqual(t.calls.map((c) => [c[0], c[1]]), [
    ['send', '/api/stats/view'],
    ['send', '/api/stats/ping'],
  ]);
  assert.deepEqual(t.calls[1][2], { id: 'abc123' });
});

test('Hintergrund-Tab: kein Timer, Beacon beim Verstecken (AC-6)', async () => {
  const t = setup({ visible: false });
  t.tracker.view('/');
  assert.equal(t.hasTimer(), false);

  const v = setup();
  v.tracker.view('/');
  await flush();
  v.tracker.hidden();
  await flush();
  assert.equal(v.hasTimer(), false);
  assert.equal(v.calls.at(-1)[0], 'beacon');
  v.tracker.visible();
  await flush();
  assert.equal(v.hasTimer(), true);
});

test('Seitenwechsel schickt letzten Ping des alten Aufrufs', async () => {
  const t = setup();
  t.tracker.view('/');
  await flush();
  t.tracker.view('/jobs');
  await flush();
  const kinds = t.calls.map((c) => c[0] + ':' + c[1].split('/').pop()).sort();
  assert.deepEqual(kinds, ['beacon:ping', 'send:view', 'send:view']);
});

test('Fehler beim Melden werfen nicht (AC-15)', async () => {
  const tracker = createTracker({
    send: () => Promise.reject(new Error('offline')),
    beacon: () => {},
    isVisible: () => true,
    setTimer: () => 1,
    clearTimer: () => {},
  });
  tracker.view('/');
  await flush();
  tracker.hidden();
  await flush();
});
