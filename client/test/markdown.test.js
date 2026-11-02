// Prüft die Markdown-Aufbereitung für Materialien (AC-4, AC-5, AC-6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/lib/markdown.js';

test('AC-4: Überschrift, Liste, Fettdruck und Link werden formatiert', () => {
  const html = renderMarkdown('# Titel\n\n- eins\n- **zwei**\n\n[Seite](https://example.com/x)');
  assert.match(html, /<h1>Titel<\/h1>/);
  assert.match(html, /<li>eins<\/li>/);
  assert.match(html, /<strong>zwei<\/strong>/);
  assert.match(html, /<a href="https:\/\/example\.com\/x" target="_blank" rel="noopener noreferrer">Seite<\/a>/);
});

test('AC-5: rohes HTML wird als Text ausgegeben, nicht als Markup', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\nText <img src=x onerror=alert(1)> Ende');
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('AC-6: Links mit anderem Schema als http, https, mailto werden nicht zu Links', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', '/relativ', 'JaVaScRiPt:alert(1)']) {
    const html = renderMarkdown(`[Klick](${bad})`);
    assert.doesNotMatch(html, /<a /i, bad);
    assert.match(html, /Klick/);
  }
  assert.match(renderMarkdown('[Mail](mailto:a@b.de)'), /<a href="mailto:a@b\.de"/);
});

test('Markdown-Bilder laden nichts nach, nur der Alt-Text erscheint', () => {
  const html = renderMarkdown('![Logo](https://tracker.example/pixel.png)');
  assert.doesNotMatch(html, /<img/i);
  assert.match(html, /Logo/);
});

test('Anführungszeichen in Link-Adressen brechen das Attribut nicht auf', () => {
  const html = renderMarkdown('[x](https://example.com/?a="b" onmouseover="alert(1)")');
  assert.doesNotMatch(html, /onmouseover="/);
});
