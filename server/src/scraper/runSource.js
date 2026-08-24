const cheerio = require('cheerio');
const eventsRepo = require('../db/eventsRepo');
const sourcesRepo = require('../db/sourcesRepo');

function resolveUrl(base, maybeRelative) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function parseDateGuess(text) {
  if (!text) return null;
  const cleaned = text.trim();

  const iso = cleaned.match(/\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/);
  if (iso) return iso[0].length === 10 ? `${iso[0]}T00:00` : iso[0];

  const de = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (de) {
    const [, d, m, yRaw] = de;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const time = cleaned.match(/(\d{1,2}):(\d{2})/);
    const hh = time ? time[1].padStart(2, '0') : '00';
    const mm = time ? time[2] : '00';
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hh}:${mm}`;
  }
  return null;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EventAggregatorBot/1.0 (+local, non-commercial event listing)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function runSource(source) {
  const html = await fetchHtml(source.list_url);
  const $ = cheerio.load(html);

  const defaultTags = (source.default_tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  const items = $(source.item_selector).toArray();

  for (const el of items) {
    try {
      const $el = $(el);
      const title = $el.find(source.title_selector).first().text().trim() || $el.find(source.title_selector).first().attr('content');
      if (!title) { failed++; continue; }

      let rawDate = null;
      if (source.date_selector) {
        const $date = $el.find(source.date_selector).first();
        rawDate = $date.attr('datetime') || $date.attr('content') || $date.text().trim();
      }
      const startDate = parseDateGuess(rawDate) || new Date().toISOString().slice(0, 16);

      const location = source.location_selector
        ? $el.find(source.location_selector).first().text().trim()
        : null;

      let link = null;
      if (source.link_selector) {
        const $link = $el.find(source.link_selector).first();
        link = resolveUrl(source.base_url, $link.attr(source.link_attr || 'href'));
      } else if (el.tagName === 'a') {
        link = resolveUrl(source.base_url, $el.attr('href'));
      }

      const description = source.description_selector
        ? $el.find(source.description_selector).first().text().trim()
        : null;

      if (link && eventsRepo.findDuplicateByUrl(link)) { skipped++; continue; }

      eventsRepo.createEvent({
        title,
        description,
        category: source.category,
        start_date: startDate,
        location,
        url: link,
        source: source.name,
        status: 'pending',
        tags: defaultTags,
      });
      inserted++;
    } catch (err) {
      failed++;
    }
  }

  sourcesRepo.markRun(source.id, `ok: ${inserted} neu, ${skipped} Duplikate, ${failed} Fehler`);
  return { inserted, skipped, failed, total: items.length };
}

async function runAllActiveSources() {
  const sources = sourcesRepo.listSources().filter((s) => s.active);
  const results = [];
  for (const source of sources) {
    try {
      const result = await runSource(source);
      results.push({ source: source.name, ...result });
    } catch (err) {
      sourcesRepo.markRun(source.id, `Fehler: ${err.message}`);
      results.push({ source: source.name, error: err.message });
    }
  }
  return results;
}

module.exports = { runSource, runAllActiveSources };
