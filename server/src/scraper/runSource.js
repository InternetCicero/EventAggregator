const cheerio = require('cheerio');
const eventsRepo = require('../db/eventsRepo');
const sourcesRepo = require('../db/sourcesRepo');

const MONTHS = {
  jan: '01', januar: '01', january: '01',
  feb: '02', februar: '02', february: '02',
  mär: '03', maer: '03', märz: '03', mar: '03', march: '03',
  apr: '04', april: '04',
  mai: '05', may: '05',
  jun: '06', juni: '06', june: '06',
  jul: '07', juli: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  okt: '10', oktober: '10', oct: '10', october: '10',
  nov: '11', november: '11',
  dez: '12', dezember: '12', dec: '12', december: '12',
};

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

  const numeric = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (numeric) {
    const [, d, m, yRaw] = numeric;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const time = cleaned.match(/(\d{1,2}):(\d{2})/);
    const hh = time ? time[1].padStart(2, '0') : '00';
    const mm = time ? time[2] : '00';
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hh}:${mm}`;
  }

  // "29. August 2026" or "29 August 2026"
  const deNamed = cleaned.match(/(\d{1,2})\.?\s+([A-Za-zÄäÖöÜü]+)\s+(\d{4})/);
  if (deNamed) {
    const [, d, monthName, y] = deNamed;
    const month = MONTHS[monthName.toLowerCase()];
    if (month) return `${y}-${month}-${d.padStart(2, '0')}T00:00`;
  }

  // "24 Aug 2026"
  const enNamed = cleaned.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (enNamed) {
    const [, monthName, d, y] = enNamed;
    const month = MONTHS[monthName.toLowerCase()];
    if (month) return `${y}-${month}-${d.padStart(2, '0')}T00:00`;
  }

  return null;
}

// Manche Seiten kombinieren Datum und Ort in einem Textfeld, z. B.
// "24. August 2026, Online" — wird als Ort-Fallback genutzt, wenn kein
// eigener location_selector konfiguriert ist bzw. dieser nichts liefert.
function extractTrailingLocation(text) {
  if (!text) return null;
  const patterns = [
    /\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/,
    /\d{1,2}\.(\d{1,2})\.\d{2,4}(\s*,?\s*\d{1,2}:\d{2})?/,
    /\d{1,2}\.?\s+[A-Za-zÄäÖöÜü]+\s+\d{4}/,
    /[A-Za-z]+\s+\d{1,2},?\s+\d{4}/,
  ];
  let rest = text;
  for (const p of patterns) {
    const m = rest.match(p);
    if (m) {
      rest = rest.slice(m.index + m[0].length);
      break;
    }
  }
  rest = rest.replace(/^[\s,•\-–]+/, '').trim();
  return rest || null;
}

async function fetchStaticHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EventAggregatorBot/1.0 (+local, non-commercial event listing)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function fetchRenderedHtml(url, itemSelector) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      userAgent: 'EventAggregatorBot/1.0 (+local, non-commercial event listing)',
    });
    // 'networkidle' never fires on pages with persistent background activity
    // (analytics beacons, polling, chat widgets), so load the DOM and then wait
    // specifically for the event items to show up instead.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (itemSelector) {
      await page.waitForSelector(itemSelector, { timeout: 15000 }).catch(() => {});
    } else {
      await page.waitForTimeout(3000);
    }
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function fetchHtml(url, renderJs, itemSelector) {
  return renderJs ? fetchRenderedHtml(url, itemSelector) : fetchStaticHtml(url);
}

function cleanText($el) {
  const $clone = $el.clone();
  $clone.find('.sr-only, .visually-hidden, [aria-hidden="true"]').remove();
  return $clone.text().replace(/\s+/g, ' ').trim();
}

// Reine Networking-Formate (Afterwork, Meetup, Stammtisch …) werden von
// Quellen oft unter einer allgemeinen Kategorie (z. B. "Bildung & Vortrag")
// mitgeführt. Titel-Schlüsselwörter markieren sie zusätzlich mit dem Tag
// "networking" und heben sie in die passende Kategorie, damit sie über den
// Tag-Filter auffindbar bleiben, egal welche Kategorie die Quelle vergibt.
const NETWORKING_KEYWORDS = /\b(afterwork|after-work|networking|netzwerk(?:abend|treffen)?|stammtisch|meet[- ]?up|mixer)\b/i;

function applyNetworkingHeuristic(title, category, tags) {
  if (!NETWORKING_KEYWORDS.test(title)) return { category, tags };
  const withTag = tags.includes('networking') ? tags : [...tags, 'networking'];
  return { category: 'Business & Networking', tags: withTag };
}

async function runSource(source) {
  const html = await fetchHtml(source.list_url, source.render_js, source.item_selector);
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
      const $title = $el.find(source.title_selector).first();
      const title = cleanText($title) || $title.attr('content');
      if (!title) { failed++; continue; }

      let rawDate = null;
      if (source.date_selector) {
        const $date = $el.find(source.date_selector).first();
        rawDate = $date.attr('datetime') || $date.attr('content') || cleanText($date);
      }
      const startDate = parseDateGuess(rawDate) || new Date().toISOString().slice(0, 16);

      let location = source.location_selector
        ? cleanText($el.find(source.location_selector).first())
        : null;
      if (!location && rawDate) {
        location = extractTrailingLocation(rawDate);
      }

      let link = null;
      if (source.link_selector) {
        const $link = $el.find(source.link_selector).first();
        link = resolveUrl(source.base_url, $link.attr(source.link_attr || 'href'));
      } else if (el.tagName === 'a') {
        link = resolveUrl(source.base_url, $el.attr('href'));
      }

      const description = source.description_selector
        ? cleanText($el.find(source.description_selector).first())
        : null;

      if (link && eventsRepo.findDuplicateByUrl(link)) { skipped++; continue; }

      const { category, tags } = applyNetworkingHeuristic(title, source.category, defaultTags);

      eventsRepo.createEvent({
        title,
        description,
        category,
        start_date: startDate,
        location,
        url: link,
        source: source.name,
        status: 'pending',
        tags,
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
