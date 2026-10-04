const cheerio = require('cheerio');
const dns = require('dns').promises;
const net = require('net');

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
    return false;
  }
  // IPv6 loopback / unique local / link-local
  const lower = address.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

async function assertPublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Ungültige URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Nur http/https-URLs erlaubt');
  }
  if (parsed.hostname === 'localhost') throw new Error('Lokale Adressen sind nicht erlaubt');

  const addresses = await dns.lookup(parsed.hostname, { all: true }).catch(() => []);
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error('Private/interne Adressen sind nicht erlaubt');
  }
  return parsed;
}

function pickNodeOfType(json, wantedType) {
  const candidates = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const type = node['@type'];
    const types = Array.isArray(type) ? type : [type];
    if (types.includes(wantedType)) candidates.push(node);
    if (node['@graph']) visit(node['@graph']);
  };
  visit(json);
  return candidates[0] || null;
}

function pickEventNode(json) {
  return pickNodeOfType(json, 'Event');
}

function locationToString(location) {
  if (!location) return null;
  if (typeof location === 'string') return location;
  if (Array.isArray(location)) return locationToString(location[0]);
  const parts = [];
  if (location.name) parts.push(location.name);
  const addr = location.address;
  if (addr) {
    if (typeof addr === 'string') parts.push(addr);
    else {
      const addrParts = [addr.streetAddress, addr.postalCode, addr.addressLocality].filter(Boolean);
      if (addrParts.length) parts.push(addrParts.join(', '));
    }
  }
  return parts.join(', ') || null;
}

function imageToString(image) {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return imageToString(image[0]);
  return image.url || null;
}

function toDatetimeLocal(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fetchPublicHtml(rawUrl) {
  const parsed = await assertPublicUrl(rawUrl);

  const res = await fetch(parsed.toString(), {
    headers: { 'User-Agent': 'LaurenzEventVerteilerBot/1.0 (+local, non-commercial event listing)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Seite konnte nicht geladen werden (HTTP ${res.status})`);
  return { parsed, html: await res.text() };
}

async function extractFromUrl(rawUrl) {
  const { parsed, html } = await fetchPublicHtml(rawUrl);
  const $ = cheerio.load(html);

  const result = {
    title: null,
    description: null,
    start_date: null,
    end_date: null,
    location: null,
    url: parsed.toString(),
    image_url: null,
    matched: 'none',
  };

  // 1. schema.org JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    if (result.matched === 'json-ld') return;
    let json;
    try {
      json = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    const event = pickEventNode(json);
    if (!event) return;
    result.title = event.name || null;
    result.description = event.description || null;
    result.start_date = toDatetimeLocal(event.startDate);
    result.end_date = toDatetimeLocal(event.endDate);
    result.location = locationToString(event.location);
    result.image_url = imageToString(event.image);
    if (event.url) result.url = event.url;
    result.matched = 'json-ld';
  });

  // 2. Open Graph fallback for whatever is still missing
  if (!result.title) result.title = $('meta[property="og:title"]').attr('content') || $('title').first().text().trim() || null;
  if (!result.description) result.description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || null;
  if (!result.image_url) result.image_url = $('meta[property="og:image"]').attr('content') || null;
  if (result.matched === 'none' && (result.title || result.description || result.image_url)) {
    result.matched = 'opengraph';
  }

  return result;
}

// --- Stellenanzeigen (schema.org JobPosting) ---

// Stellenbeschreibungen in JSON-LD sind fast immer HTML; für das Formular
// wird reiner Text mit erhaltenen Absätzen gebraucht.
function htmlToText(html) {
  if (!html) return null;
  const $ = cheerio.load(`<div id="root">${String(html).replace(/<br\s*\/?>/gi, '\n')}</div>`);
  $('#root')
    .find('p, li, div, h1, h2, h3, h4')
    .each((_, el) => {
      $(el).append('\n');
    });
  const text = $('#root')
    .text()
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}

function toDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// baseSalary -> Monatsbrutto (Spec A2). Jahresangaben werden durch 12
// geteilt, Stunden-/Wochenangaben ignoriert, weil die Umrechnung zu ungenau ist.
function salaryToMonthly(baseSalary) {
  if (!baseSalary || typeof baseSalary !== 'object') return { salary_min: null, salary_max: null };
  const value = baseSalary.value && typeof baseSalary.value === 'object' ? baseSalary.value : baseSalary;
  const unit = String(value.unitText || baseSalary.unitText || 'MONTH').toUpperCase();
  const factor = unit === 'MONTH' ? 1 : unit === 'YEAR' ? 1 / 12 : null;
  if (factor === null) return { salary_min: null, salary_max: null };
  const conv = (v) => (v === undefined || v === null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * factor));
  const single = typeof baseSalary.value === 'number' ? baseSalary.value : value.value;
  return {
    salary_min: conv(value.minValue ?? single),
    salary_max: conv(value.maxValue ?? single),
  };
}

const EMPLOYMENT_TYPE_MAP = { INTERN: 'praktikum', INTERNSHIP: 'praktikum' };

function parseJobPostingHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  const result = {
    title: null,
    description: null,
    company_name: null,
    location: null,
    work_mode: null,
    job_type: null,
    deadline: null,
    salary_min: null,
    salary_max: null,
    apply_url: pageUrl,
    matched: 'none',
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    if (result.matched === 'json-ld') return;
    let json;
    try {
      json = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    const job = pickNodeOfType(json, 'JobPosting');
    if (!job) return;
    // JSON-LD-Strings enthalten oft HTML-Entities (z. B. "IT-M&amp;A")
    result.title = htmlToText(job.title || job.name);
    result.description = htmlToText(job.description);
    const org = Array.isArray(job.hiringOrganization) ? job.hiringOrganization[0] : job.hiringOrganization;
    result.company_name = htmlToText(org && (typeof org === 'string' ? org : org.name));
    result.location = locationToString(job.jobLocation);
    if (String(job.jobLocationType || '').toUpperCase() === 'TELECOMMUTE') result.work_mode = 'remote';
    const employmentTypes = [].concat(job.employmentType || []).map((t) => String(t).toUpperCase());
    result.job_type = employmentTypes.map((t) => EMPLOYMENT_TYPE_MAP[t]).find(Boolean) || null;
    result.deadline = toDate(job.validThrough);
    Object.assign(result, salaryToMonthly(job.baseSalary));
    if (job.url) result.apply_url = job.url;
    result.matched = 'json-ld';
  });

  if (!result.title) result.title = $('meta[property="og:title"]').attr('content') || $('title').first().text().trim() || null;
  if (!result.description) result.description = $('meta[property="og:description"]').attr('content') || null;
  if (result.matched === 'none' && (result.title || result.description)) result.matched = 'opengraph';

  return result;
}

async function extractJobFromUrl(rawUrl) {
  const { parsed, html } = await fetchPublicHtml(rawUrl);
  return parseJobPostingHtml(html, parsed.toString());
}

module.exports = {
  extractFromUrl,
  extractJobFromUrl,
  parseJobPostingHtml,
  salaryToMonthly,
  htmlToText,
  // Für Unit-Tests: reine Funktionen ohne Netzwerkzugriff.
  isPrivateAddress,
  assertPublicUrl,
  pickEventNode,
  locationToString,
  toDatetimeLocal,
};
