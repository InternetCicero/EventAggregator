const { expect } = require('@playwright/test');

// Wächter für Konsolenfehler und fehlgeschlagene Anfragen (AC-5).
// Aufruf vor page.goto(); am Testende expectClean(guard).
function watchPage(page) {
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push('console: ' + m.text());
  });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => problems.push('request failed: ' + r.url()));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('/api/stats/')) {
      problems.push(`${r.status()}: ${r.url()}`);
    }
  });
  return problems;
}

function expectClean(problems) {
  expect(problems, problems.join('\n')).toEqual([]);
}

// Kein horizontaler Seitenüberlauf (AC-1).
async function expectNoPageOverflow(page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'Seite ist breiter als das Fenster').toBeLessThanOrEqual(innerWidth);
}

// Kein Element ragt über seinen sichtbaren Container hinaus (AC-2, AC-3):
// Ein Kindelement darf nicht rechts über das Eltern-Element hinausstehen,
// es sei denn, das Eltern-Element scrollt bewusst (overflow auto/scroll).
async function expectNoElementOverflow(page, selector) {
  const offenders = await page.evaluate((sel) => {
    const bad = [];
    for (const root of document.querySelectorAll(sel)) {
      const rootRect = root.getBoundingClientRect();
      for (const el of root.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right > rootRect.right + 1) {
          bad.push(`${el.tagName.toLowerCase()}.${el.className} ragt ${Math.round(r.right - rootRect.right)}px heraus`);
        }
      }
      if (root.scrollWidth > root.clientWidth + 1) {
        const style = getComputedStyle(root).overflowX;
        if (style !== 'auto' && style !== 'scroll') {
          bad.push(`${root.tagName.toLowerCase()}.${root.className}: scrollWidth ${root.scrollWidth} > clientWidth ${root.clientWidth}`);
        }
      }
    }
    return bad;
  }, selector);
  expect(offenders, offenders.join('\n')).toEqual([]);
}

module.exports = { watchPage, expectClean, expectNoPageOverflow, expectNoElementOverflow };
