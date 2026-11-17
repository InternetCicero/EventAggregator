const { test, expect } = require('@playwright/test');
const { watchPage, expectClean, expectNoPageOverflow, expectNoElementOverflow } = require('./helpers');

async function openStats(page) {
  await page.goto('/admin');
  await page.getByLabel('Nutzername').fill('admin');
  await page.getByLabel('Passwort').fill('e2e-test');
  await page.getByRole('button', { name: /einloggen/i }).click();
  await page.locator('.admin-tabs').getByRole('button', { name: 'Statistik' }).click();
  await expect(page.getByRole('heading', { name: 'Besucherstatistik' })).toBeVisible();
  await expect(page.locator('.stats-card').first()).toBeVisible();
}

async function pick(page, label) {
  await page.locator('.stats-range').getByRole('button', { name: label, exact: true }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.stats-body.is-loading')).toHaveCount(0);
}

test('Statistik: Besucher pro Tag stehen direkt am Balken, ohne Hover (AC-1)', async ({ page }) => {
  await openStats(page);
  // 7 Tage: jeder Balken trägt seinen Besucherwert als Text
  await expect(page.locator('.stats-col-value')).toHaveCount(7);
  const values = await page.locator('.stats-col-value').allTextContents();
  expect(values.every((v) => /^\d/.test(v.trim()))).toBe(true);
  // Tabelle mit allen Tagen
  await page.locator('.stats-details summary').click();
  await expect(page.locator('.stats-details tbody tr')).toHaveCount(7);
  // der laufende Tag ist markiert
  await expect(page.locator('.stats-col.is-partial')).toHaveCount(1);
  await expect(page.locator('.stats-details tbody tr').first()).toContainText('läuft noch');
});

for (const label of ['7 Tage', '30 Tage', '90 Tage', '12 Monate']) {
  test(`Statistik ${label}: kein Überlauf, keine Konsolenfehler (AC-9)`, async ({ page }) => {
    const problems = watchPage(page);
    await openStats(page);
    await pick(page, label);
    await page.locator('.stats-details summary').click();
    await expectNoPageOverflow(page);
    await expectNoElementOverflow(page, '.stats-card');
    await expectNoElementOverflow(page, '.stats-breakdown');
    expectClean(problems);
  });
}

test('Statistik: 12 Monate zeigt zwölf Monatsbalken', async ({ page }) => {
  await openStats(page);
  await pick(page, '12 Monate');
  await expect(page.locator('.stats-col')).toHaveCount(12);
});

test('Statistik: leerer Zeitraum zeigt "Noch keine Daten" (AC-9)', async ({ page }) => {
  const problems = watchPage(page);
  await openStats(page);
  await page.locator('.stats-range').getByRole('button', { name: 'Zeitraum …' }).click();
  await page.getByLabel('Von').fill('2020-01-01');
  await page.getByLabel('Bis').fill('2020-01-31');
  await page.getByRole('button', { name: 'Anwenden' }).click();
  await expect(page.getByText('Noch keine Daten in diesem Zeitraum.')).toBeVisible();
  await expectNoPageOverflow(page);
  expectClean(problems);
});
