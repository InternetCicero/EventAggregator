const { test, expect } = require('@playwright/test');
const {
  watchPage,
  expectClean,
  expectNoPageOverflow,
  expectNoElementOverflow,
} = require('./helpers');

const PUBLIC_PAGES = [
  ['Veranstaltungen', '/'],
  ['Event einreichen', '/einreichen'],
  ['Stellen', '/jobs'],
  ['Stelle einreichen', '/jobs/einreichen'],
  ['Materialien', '/materialien'],
  ['Datenschutz', '/datenschutz'],
  ['Impressum', '/impressum'],
];

for (const [name, path] of PUBLIC_PAGES) {
  test(`${name}: kein Seitenüberlauf, keine Konsolenfehler`, async ({ page }) => {
    const problems = watchPage(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expectNoPageOverflow(page);
    expectClean(problems);
  });
}

test('Eventkarten: extrem lange Texte laufen nicht über', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.event-card')).toHaveCount(2);
  await expectNoPageOverflow(page);
  await expectNoElementOverflow(page, '.event-card');
});

test('Stellenkarten und Detailseite: extrem lange Texte laufen nicht über', async ({ page }) => {
  await page.goto('/jobs');
  await expect(page.locator('.job-card')).toHaveCount(2);
  await expectNoPageOverflow(page);
  await expectNoElementOverflow(page, '.job-card');

  await page.locator('.job-card').filter({ hasText: 'Supercali' }).locator('a').first().click();
  await page.waitForLoadState('networkidle');
  await expectNoPageOverflow(page);
  await expectNoElementOverflow(page, 'main');
});

test('Materialien: Detailseite läuft nicht über', async ({ page }) => {
  await page.goto('/materialien');
  await page.locator('a[href^="/materialien/"]').first().click();
  await page.waitForLoadState('networkidle');
  await expectNoPageOverflow(page);
});

test('Navigation ist erreichbar und überlappt keine Inhalte', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('.app-nav');
  await expect(nav).toBeVisible();
  for (const label of ['Events', 'Jobs & Praktika', 'Materialien']) {
    const link = nav.getByRole('link', { name: label }).first();
    await expect(link, label).toBeVisible();
  }
  const navBox = await nav.boundingBox();
  const mainBox = await page.locator('main').first().boundingBox();
  expect(mainBox.y, 'Inhalt beginnt unter der Navigation').toBeGreaterThanOrEqual(navBox.y + navBox.height - 1);
});
