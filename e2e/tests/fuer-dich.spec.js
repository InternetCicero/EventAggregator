// Unternavigation und "Für dich" (Spec 2026-11-07-fuer-dich)
const { test, expect } = require('@playwright/test');
const { watchPage, expectClean, expectNoPageOverflow, expectNoElementOverflow } = require('./helpers');

// Eindeutiges Schlagwort: darf in keiner Anfrage an den Server auftauchen (AC-10)
const MARKER = 'zz-testprofil-7341';

test('AC-1: Hauptnavigation hat genau Events, Jobs & Praktika, Materialien, Admin', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('.app-nav a');
  await expect(links).toHaveText(['Events', 'Jobs & Praktika', 'Materialien', 'Admin']);
});

for (const [path, activeTab] of [
  ['/', 'Alle Events'],
  ['/fuer-dich', 'Für dich'],
  ['/einreichen', 'Event hinzufügen'],
]) {
  test(`AC-2: ${path} gehört zu Events, Reiter "${activeTab}" aktiv`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('.app-nav a.active')).toHaveText('Events');
    const tabs = page.locator('.section-tabs a');
    await expect(tabs).toHaveText(['Alle Events', 'Für dich', 'Event hinzufügen']);
    await expect(page.locator('.section-tabs a.is-active')).toHaveText(activeTab);
  });
}

for (const [path, activeTab] of [
  ['/jobs', 'Alle Stellen'],
  ['/jobs/einreichen', 'Stelle einreichen'],
]) {
  test(`AC-3: ${path} gehört zu Jobs & Praktika, Reiter "${activeTab}" aktiv`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('.app-nav a.active')).toHaveText('Jobs & Praktika');
    await expect(page.locator('.section-tabs a')).toHaveText(['Alle Stellen', 'Stelle einreichen']);
    await expect(page.locator('.section-tabs a.is-active')).toHaveText(activeTab);
  });
}

test('AC-3: Stellen-Detailseite markiert Jobs & Praktika', async ({ page }) => {
  await page.goto('/jobs');
  await page.locator('.job-card a').first().click();
  await expect(page).toHaveURL(/\/jobs\/\d+$/);
  await expect(page.locator('.app-nav a.active')).toHaveText('Jobs & Praktika');
});

test('AC-4: Für dich ohne Seitenüberlauf und ohne Konsolenfehler', async ({ page }) => {
  const problems = watchPage(page);
  await page.goto('/fuer-dich');
  await page.waitForLoadState('networkidle');
  await expectNoPageOverflow(page);
  await expectNoElementOverflow(page, '.section-tabs');
  expectClean(problems);
});

test('AC-5, AC-9, AC-10: Profil anlegen, Empfehlungen sehen, neu laden, löschen – ohne Profildaten an den Server', async ({
  page,
}) => {
  const requests = [];
  page.on('request', (r) => {
    requests.push(JSON.stringify({ url: r.url(), body: r.postData(), headers: r.headers() }));
  });
  page.on('dialog', (d) => d.accept());
  const problems = watchPage(page);

  await page.goto('/fuer-dich');
  await expect(page.getByRole('button', { name: 'Profil speichern' })).toBeDisabled();

  await page.getByRole('button', { name: 'Networking: neutral' }).click();
  await page.getByRole('button', { name: 'Workshop & Case Study: neutral' }).click();
  await page.getByPlaceholder('Schlagwort eingeben').fill(MARKER);
  await page.getByPlaceholder('Schlagwort eingeben').press('Enter');
  await page.getByPlaceholder('z. B. München').fill('Frankfurt');
  await page.getByRole('button', { name: 'Profil speichern' }).click();

  // "Normales Event": Networking in Frankfurt -> Passt sehr gut, mit Begründung
  const top = page.locator('.for-you-group').filter({ hasText: 'Passt sehr gut' });
  const card = top.locator('.event-card').filter({ hasText: 'Normales Event' });
  await expect(card).toBeVisible();
  await expect(card.locator('.event-card-reasons')).toContainText('Kategorie Networking');
  await expect(card.locator('.event-card-reasons')).toContainText('in Frankfurt');
  await expectNoPageOverflow(page);
  await expectNoElementOverflow(page, '.event-card');

  // AC-5: nach dem Neuladen ist das Profil noch da
  await page.reload();
  await expect(page.locator('.profile-summary')).toContainText(MARKER);
  await expect(card).toBeVisible();

  // AC-9: Löschen führt zurück zum Einstieg
  await page.getByRole('button', { name: 'Profil bearbeiten' }).click();
  await page.getByRole('button', { name: 'Profil löschen' }).click();
  await expect(page.getByRole('button', { name: 'Networking: neutral' })).toBeVisible();
  await expect(page.locator('.for-you-group')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('studenthub.profile'))).toBeNull();

  // AC-10: das Schlagwort taucht in keiner Anfrage auf (URL, Body, Header)
  const leaks = requests.filter((r) => r.includes(MARKER) || r.includes('zz testprofil'));
  expect(leaks, leaks.join('\n')).toEqual([]);
  expect(requests.length).toBeGreaterThan(0);
  expectClean(problems);
});

test('AC-11: Datenschutzerklärung beschreibt das Profil', async ({ page }) => {
  await page.goto('/datenschutz');
  await expect(page.getByRole('heading', { name: /Persönliches Profil/ })).toBeVisible();
  await expect(page.locator('.legal-page')).toContainText('nie an unseren Server');
});
