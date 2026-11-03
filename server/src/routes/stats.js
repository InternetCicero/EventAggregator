const express = require('express');
const statsRepo = require('../db/statsRepo');
const { normalizePath, isBot } = require('../stats/path');

const router = express.Router();

const LIMIT_PER_MINUTE = 120;
const hits = new Map(); // Schlüssel: IP + User-Agent, nur im Arbeitsspeicher
let windowStart = Date.now();

function limited(key) {
  const now = Date.now();
  if (now - windowStart > 60 * 1000) {
    hits.clear();
    windowStart = now;
  }
  const count = (hits.get(key) || 0) + 1;
  hits.set(key, count);
  return count > LIMIT_PER_MINUTE;
}

function optedOut(req) {
  return req.get('dnt') === '1' || req.get('sec-gpc') === '1';
}

router.post('/view', (req, res) => {
  const userAgent = req.get('user-agent') || '';
  const path = normalizePath(req.body && req.body.path);
  if (!path || optedOut(req) || isBot(userAgent) || limited(`${req.ip}|${userAgent}`)) {
    return res.status(204).end();
  }
  try {
    const id = statsRepo.recordView({ ip: req.ip, userAgent, path });
    res.json({ id });
  } catch (err) {
    console.error('[stats] view:', err.message);
    res.status(204).end();
  }
});

router.post('/ping', (req, res) => {
  const id = req.body && req.body.id;
  if (typeof id === 'string' && /^[0-9a-f]{16}$/.test(id) && !optedOut(req)) {
    if (!limited(`${req.ip}|${req.get('user-agent') || ''}`)) {
      try {
        statsRepo.recordPing({ id });
      } catch (err) {
        console.error('[stats] ping:', err.message);
      }
    }
  }
  res.status(204).end();
});

module.exports = router;
