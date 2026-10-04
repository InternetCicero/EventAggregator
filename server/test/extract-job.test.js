// Vorbefüllung aus schema.org JobPosting (Spec AC-16, AC-17).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseJobPostingHtml, salaryToMonthly, extractJobFromUrl } = require('../src/scraper/extractFromUrl');

const jobPosting = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', name: 'Irrelevant' },
    {
      '@type': 'JobPosting',
      title: 'Praktikant (m/w/d) M&A',
      description: '<p>Du unterstützt das <b>Deal-Team</b>.</p><ul><li>Analysen</li><li>Pitches</li></ul>',
      hiringOrganization: { '@type': 'Organization', name: 'Beispiel Bank AG' },
      jobLocation: { '@type': 'Place', address: { addressLocality: 'Frankfurt am Main', postalCode: '60311' } },
      employmentType: ['INTERN'],
      validThrough: '2026-11-30T23:59:00+01:00',
      baseSalary: { '@type': 'MonetaryAmount', currency: 'EUR', value: { minValue: 1800, maxValue: 2100, unitText: 'MONTH' } },
      url: 'https://karriere.example.com/jobs/123',
    },
  ],
};

const html = `<html><head><script type="application/ld+json">${JSON.stringify(jobPosting)}</script></head></html>`;

test('AC-16: JobPosting-Felder werden ausgelesen', () => {
  const r = parseJobPostingHtml(html, 'https://karriere.example.com/seite');
  assert.equal(r.matched, 'json-ld');
  assert.equal(r.title, 'Praktikant (m/w/d) M&A');
  assert.equal(r.company_name, 'Beispiel Bank AG');
  assert.equal(r.location, '60311, Frankfurt am Main');
  assert.equal(r.deadline, '2026-11-30');
  assert.equal(r.job_type, 'praktikum');
  assert.equal(r.salary_min, 1800);
  assert.equal(r.salary_max, 2100);
  assert.equal(r.apply_url, 'https://karriere.example.com/jobs/123');
  // HTML wird zu Text mit Zeilenumbrüchen
  assert.ok(r.description.includes('Du unterstützt das Deal-Team.'));
  assert.ok(!r.description.includes('<'));
  assert.ok(r.description.includes('Analysen\nPitches'));
});

test('AC-16: Jahresgehalt wird in Monatsbrutto umgerechnet, Stundenlohn ignoriert', () => {
  assert.deepEqual(salaryToMonthly({ value: { minValue: 48000, maxValue: 54000, unitText: 'YEAR' } }), {
    salary_min: 4000,
    salary_max: 4500,
  });
  assert.deepEqual(salaryToMonthly({ value: { value: 15, unitText: 'HOUR' } }), { salary_min: null, salary_max: null });
});

test('AC-16: ohne JSON-LD Fallback auf Open Graph und Seiten-URL als Bewerbungslink', () => {
  const r = parseJobPostingHtml('<html><head><meta property="og:title" content="Werkstudent Data"></head></html>', 'https://x.example/job');
  assert.equal(r.matched, 'opengraph');
  assert.equal(r.title, 'Werkstudent Data');
  assert.equal(r.apply_url, 'https://x.example/job');
});

test('AC-17: lokale und private Adressen werden abgelehnt', async () => {
  await assert.rejects(() => extractJobFromUrl('http://localhost:4000/'), /Lokale Adressen/);
  await assert.rejects(() => extractJobFromUrl('http://127.0.0.1/'), /Private\/interne/);
  await assert.rejects(() => extractJobFromUrl('file:///etc/passwd'), /http\/https/);
});

test('HTML-Entities in Titel und Firmenname werden dekodiert', () => {
  const posting = {
    '@type': 'JobPosting',
    title: 'Praktikant im Consulting für IT-M&amp;A',
    hiringOrganization: { name: 'Müller &amp; Söhne' },
  };
  const r = parseJobPostingHtml(`<script type="application/ld+json">${JSON.stringify(posting)}</script>`, 'https://x.example');
  assert.equal(r.title, 'Praktikant im Consulting für IT-M&A');
  assert.equal(r.company_name, 'Müller & Söhne');
});
