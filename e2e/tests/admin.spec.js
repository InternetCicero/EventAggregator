const { test, expect } = require('@playwright/test');
const {
  watchPage,
  expectClean,
  expectNoPageOverflow,
  expectNoElementOverflow,
} = require('./helpers');

async function login(page) {
  await page.goto('/admin');
  await page.getByLabel('Nutzername').fill('admin');
  await page.getByLabel('Passwort').fill('e2e-test');
  await page.getByRole('button', { name: /einloggen|login|anmelden/i }).click();
  await expect(page.getByRole('heading', { name: 'Admin-Bereich' })).toBeVisible();
}

test('Admin: Quellentabelle mit 300-Zeichen-URL bleibt im Container', async ({ page }) => {
  await login(page);
  await expect(page.getByText('Quelle mit sehr langer URL')).toBeVisible();
  await expectNoPageOverflow(page);
  await expectNoElementOverflow(page, '.admin-table');
});

test('Admin: alle Reiter öffnen ohne Fehler und ohne Überlauf', async ({ page }) => {
  const problems = watchPage(page);
  await login(page);
  for (const tab of ['Events', 'Stellen', 'Firmen', 'Statistik']) {
    await page.locator('.admin-tabs').getByRole('button', { name: tab }).click();
    await page.waitForLoadState('networkidle');
    await expectNoPageOverflow(page);
  }
  expectClean(problems);
});
