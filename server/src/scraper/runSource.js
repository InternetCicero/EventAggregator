const cheerio = require('cheerio');
const eventsRepo = require('../db/eventsRepo');
const sourcesRepo = require('../db/sourcesRepo');
const { classifyCategory, inferFormat } = require('./classify');

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

// `now` ist für Tests injizierbar (Tag/Monat-ohne-Jahr-Logik hängt vom
// aktuellen Datum ab); im Normalbetrieb bleibt es beim echten "jetzt".
function parseDateGuess(text, now = new Date()) {
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

  // "29. August 2026", "29 August 2026" oder "29. August, 2026" (Komma vor
  // dem Jahr, z. B. Phenom-People-Widgets: "22. Oktober, 2025")
  const deNamed = cleaned.match(/(\d{1,2})\.?\s+([A-Za-zÄäÖöÜü]+),?\s+(\d{4})/);
  if (deNamed) {
    const [, d, monthName, y] = deNamed;
    const month = MONTHS[monthName.toLowerCase()];
    if (month) return `${y}-${month}-${d.padStart(2, '0')}T00:00`;
  }

  // "24 Aug 2026"
  const enNamed = cleaned.match(/([A-Za-zÄäÖöÜü]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (enNamed) {
    const [, monthName, d, y] = enNamed;
    const month = MONTHS[monthName.toLowerCase()];
    if (month) return `${y}-${month}-${d.padStart(2, '0')}T00:00`;
  }

  // Manche Kalender zeigen pro Karte nur Tag + Monat ohne Jahr (z. B. "30 Sep",
  // typischerweise aus zwei separaten Elementen wie date-day/date-month
  // zusammengesetzt). Das Jahr wird auf das aktuelle Jahr geraten; liegt das
  // Ergebnis mehr als ein paar Tage in der Vergangenheit, wird angenommen,
  // dass sich die Angabe schon aufs nächste Jahr bezieht.
  // Nicht verankert (kein ^…$), damit auch mehrtägige Bereiche wie
  // "20 Okt - 21 Okt" erkannt werden — es zählt dann der erste (Start-)Termin.
  const dayMonthNoYear = cleaned.match(/(\d{1,2})\.?\s+([A-Za-zÄäÖöÜü]+)\b/);
  if (dayMonthNoYear) {
    const [, d, monthName] = dayMonthNoYear;
    const month = MONTHS[monthName.toLowerCase()];
    if (month) {
      let year = now.getFullYear();
      const guess = new Date(`${year}-${month}-${d.padStart(2, '0')}T00:00:00`);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      if (!Number.isNaN(guess.getTime()) && guess < threeDaysAgo) year += 1;
      return `${year}-${month}-${d.padStart(2, '0')}T00:00`;
    }
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
    headers: { 'User-Agent': 'LaurenzEventVerteilerBot/1.0 (+local, non-commercial event listing)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

// Blättern: Seitenzahlen/"Weiter"-Knöpfe, die nur im Browser umschalten (die
// Adresse bleibt gleich), lassen sich per Klick durchlaufen. Jede Seite wird
// als HTML-Momentaufnahme gesammelt. Abbruch bei: fehlendem oder gesperrtem
// Knopf, Klickfehler, unverändertem Inhalt nach dem Klick (letzte Seite),
// erreichtem max_pages oder überschrittenem Zeitbudget.
const PAGE_CLICK_TIMEOUT_MS = 5000;
const PAGE_CHANGE_TIMEOUT_MS = 8000;
const PAGINATION_BUDGET_MS = 120000;

// Ist der "Weiter"-Knopf gesperrt? Geprüft werden das disabled-Attribut,
// aria-disabled und eine Klasse, die selbst "disabled" heißt (auch "is-disabled",
// "btn--disabled"). Tailwind-Varianten wie "disabled:pointer-events-none"
// stehen an jedem Knopf und bedeuten nur "Stil, falls gesperrt", nicht "ist
// gesperrt" — sie dürfen nicht zählen. Greift das nicht (eine letzte Seite
// ohne erkennbare Sperre), bricht der Abruf ohnehin ab, sobald sich der
// Inhalt nach dem Klick nicht mehr ändert.
function looksDisabled({ disabled, ariaDisabled, className } = {}) {
  if (disabled || ariaDisabled === 'true') return true;
  return String(className || '')
    .split(/\s+/)
    .some((token) => !token.includes(':') && /(^|[-_])disabled($|[-_])/i.test(token));
}

async function itemSignature(page, itemSelector) {
  return page.evaluate((sel) => {
    const items = [...document.querySelectorAll(sel)];
    return items.length + '::' + items.slice(0, 5).map((e) => e.textContent.trim()).join('|').slice(0, 2000);
  }, itemSelector);
}

async function fetchRenderedPages(url, { itemSelector, nextSelector, maxPages = 1 } = {}) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      userAgent: 'LaurenzEventVerteilerBot/1.0 (+local, non-commercial event listing)',
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
    const pages = [await page.content()];
    if (!nextSelector || !itemSelector) return pages;

    const deadline = Date.now() + PAGINATION_BUDGET_MS;
    while (pages.length < maxPages && Date.now() < deadline) {
      const next = page.locator(nextSelector).first();
      if ((await next.count()) === 0) break;
      const state = await next.evaluate((el) => ({
        disabled: !!el.disabled,
        ariaDisabled: el.getAttribute('aria-disabled'),
        className: typeof el.className === 'string' ? el.className : '',
      }));
      if (looksDisabled(state)) break;

      const before = await itemSignature(page, itemSelector);
      try {
        await next.click({ timeout: PAGE_CLICK_TIMEOUT_MS });
      } catch {
        break;
      }
      // Auf neue Events warten. Wechselt der Klick die ganze Seite (normaler
      // Link statt Inhaltstausch), ist der Ausführungskontext kurz weg und die
      // Liste zwischendurch leer; beides darf weder als "letzte Seite" noch als
      // neue Seite zählen. Daher abfragen, Fehler/leere Liste überspringen und
      // erst bei geänderter, nicht leerer Liste übernehmen.
      const changeDeadline = Date.now() + PAGE_CHANGE_TIMEOUT_MS;
      let changed = false;
      while (!changed && Date.now() < changeDeadline) {
        const now = await itemSignature(page, itemSelector).catch(() => null);
        if (now && now !== before && !now.startsWith('0::')) changed = true;
        else await page.waitForTimeout(250);
      }
      if (!changed) break;
      pages.push(await page.content());
    }
    return pages;
  } finally {
    await browser.close();
  }
}

// Liefert eine Liste von HTML-Seiten (bei statischen Quellen genau eine).
// Blättern funktioniert nur mit Browser-Rendering, weil der Klick JavaScript braucht.
async function fetchPages(source) {
  if (!source.render_js) return [await fetchStaticHtml(source.list_url)];
  return fetchRenderedPages(source.list_url, {
    itemSelector: source.item_selector,
    nextSelector: source.next_selector,
    maxPages: source.max_pages,
  });
}

function cleanText($el) {
  const $clone = $el.clone();
  $clone.find('.sr-only, .visually-hidden, [aria-hidden="true"]').remove();
  // Nach jedem Element ein Leerzeichen einfügen: Kalender setzen Monat, Tag
  // und Jahr oft in aufeinanderfolgende <span>s ohne Leerraum dazwischen
  // ("Nov"+"03"+"2026"), die .text() sonst zu "Nov032026" verklebt.
  // Dadurch entstehende Leerzeichen vor Satzzeichen werden wieder entfernt.
  $clone.find('*').after(' ');
  return $clone
    .text()
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

// Titel-Schlüsselwörter (siehe classify.js) haben Vorrang vor der Standard-
// Kategorie der Quelle: ein "Afterwork with HHL" wird als "Networking"
// erkannt, auch wenn die Quelle sonst z. B. "Bildung & Vortrag" liefert.
// Zusätzlich wird bei Networking-Events weiterhin der Tag "networking"
// vergeben, damit sie auch über den Tag-Filter auffindbar bleiben.
function classifyEvent(title, defaultCategory, tags) {
  const category = classifyCategory(title, defaultCategory);
  if (category !== 'Networking') return { category, tags };
  const withTag = tags.includes('networking') ? tags : [...tags, 'networking'];
  return { category, tags: withTag };
}

// deps.fetchPages ist für Tests austauschbar (ohne Netzwerk/Browser).
async function runSource(source, deps = {}) {
  const pages = await (deps.fetchPages || fetchPages)(source);

  const defaultTags = (source.default_tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  let crossSource = 0;
  let flagged = 0;

  let total = 0;

  for (const html of pages) {
    const $ = cheerio.load(html);
    const items = $(source.item_selector).toArray();
    total += items.length;

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
        const parsedDate = parseDateGuess(rawDate);
        const startDate = parsedDate || new Date().toISOString().slice(0, 16);

        let location = source.location_selector
          ? cleanText($el.find(source.location_selector).first())
          : null;
        // Der Ort-aus-Datum-Fallback gilt nur, wenn die Quelle gar keinen
        // eigenen location_selector hat (Datum und Ort stehen dann im selben
        // Textfeld, siehe SQUEAKER). Hat die Quelle einen location_selector,
        // der bei einzelnen Karten nur leer bleibt (z. B. fehlendes "Ort"-Feld),
        // darf das Datum nicht versehentlich als Ort landen.
        if (!location && !source.location_selector && rawDate) {
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

        if (link && eventsRepo.findDuplicateByUrlAndTitle(link, title)) { skipped++; continue; }
        // Ohne eigenen Link je Event: Duplikate über Titel + Startzeit erkennen
        // und die Listen-URL als Anmelde-/Infolink verwenden.
        if (!link) {
          if (eventsRepo.findDuplicateByTitleAndStart(title, startDate)) { skipped++; continue; }
          link = source.list_url;
        }

        // Quellenübergreifende Duplikate (Titel + Tag, siehe db/duplicates.js).
        // Ohne erkennbares Datum (Ersatzwert "jetzt") wird nicht verglichen.
        let duplicateOf = null;
        if (parsedDate) {
          const hit = eventsRepo.findDuplicateCandidate({ title, start_date: startDate, location, source: source.name });
          if (hit && hit.level === 'duplicate') {
            skipped++;
            crossSource++;
            eventsRepo.addListing(hit.event.id, { source: source.name, url: link, title });
            continue;
          }
          if (hit) {
            duplicateOf = hit.event.id;
            flagged++;
          }
        }

        const { category, tags } = classifyEvent(title, source.category, defaultTags);
        const format = inferFormat(location);

        eventsRepo.createEvent({
          title,
          description,
          category,
          format,
          start_date: startDate,
          location,
          url: link,
          source: source.name,
          status: 'pending',
          tags,
          duplicate_of: duplicateOf,
        });
        inserted++;
      } catch (err) {
        failed++;
      }
    }
  }

  const pageNote = pages.length > 1 ? `, ${pages.length} Seiten` : '';
  const crossNote = crossSource > 0 ? ` (${crossSource} quellenübergreifend)` : '';
  const flaggedNote = flagged > 0 ? `, ${flagged} markiert` : '';
  sourcesRepo.markRun(
    source.id,
    `ok: ${inserted} neu, ${skipped} Duplikate${crossNote}${flaggedNote}, ${failed} Fehler${pageNote}`,
  );
  return { inserted, skipped, failed, total, pages: pages.length, crossSource, flagged };
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

module.exports = {
  runSource,
  runAllActiveSources,
  // Für Unit-Tests: reine Funktionen ohne Netzwerk-/DB-Zugriff.
  parseDateGuess,
  extractTrailingLocation,
  classifyEvent,
  resolveUrl,
  cleanText,
  fetchRenderedPages,
  looksDisabled,
};
