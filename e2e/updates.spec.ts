import { expect, test, type Page } from '@playwright/test';
import { buildVersions, expectUpdateWithoutReload, markPage, pageMarked, serveBuilds, updateButton, waitForController, type BuildServer } from '@huishouden/pwa-kit/e2e-update';
import { member, showHub } from './fixtures/hub';

// A deploy under an open page (kit STANDARD.md "Updates"): build A and build B of this branch,
// served locally; the hub on A must not reload when B arrives, and keeps its screen and input.
// The household is a preview (window.__hubPreview), which a reload forgets: after one, the address
// alone says which screen to show, and the preview is shown again to check it.

const sections = (page: Page) => page.getByRole('navigation', { name: 'Sections' });
const current = (page: Page) => sections(page).locator('button[aria-current="page"]');

test.describe('a new version while the hub is open', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });
  let builds: Record<string, string>;
  let server: BuildServer;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    builds = buildVersions(['1.0.0-a', '1.0.0-b']);
    server = await serveBuilds(builds, '/');
  });
  test.afterAll(async () => server?.close());

  test('no reload under a half-filled contact; it applies when the hub is hidden with nothing unsaved, back on Contacts', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'New contact' });
    await expectUpdateWithoutReload(page, {
      server,
      builds,
      from: '1.0.0-a',
      to: '1.0.0-b',
      open: async (p) => {
        await p.goto(`${server.url}contacts`);
        await showHub(p, member());
        await p.getByRole('button', { name: 'Add contact' }).click();
        await dialog.getByLabel('Name', { exact: true }).fill('Jordan Example');
      },
      check: async (p) => {
        await expect(current(p)).toHaveText('Contacts');
        await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Jordan Example');
      },
      clear: async () => {
        await dialog.getByRole('button', { name: 'Close' }).click();
        await expect(dialog).toHaveCount(0);
      },
      checkAfter: async (p) => {
        await expect(p).toHaveURL(/\/contacts$/);
        await showHub(p, member());
        await expect(current(p)).toHaveText('Contacts');
      },
    });
  });

  test('the Update button applies it at once, on the same screen', async ({ page }) => {
    server.use('1.0.0-a');
    await page.goto(`${server.url}calendar`);
    await waitForController(page);
    await markPage(page);
    server.use('1.0.0-b');
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect(updateButton(page)).toBeVisible({ timeout: 30_000 });
    expect(await pageMarked(page), 'nothing reloaded on its own').toBe(true);
    const reloaded = page.waitForEvent('load');
    await updateButton(page).click();
    await reloaded;
    expect(await pageMarked(page)).toBe(false);
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(updateButton(page)).toBeHidden();
  });
});

test('a reload and Back return to the screen in the address', async ({ page }) => {
  await page.goto('/today');
  await showHub(page, member());
  await expect(current(page)).toHaveText('Today');
  await sections(page).getByRole('button', { name: 'Calendar' }).click();
  await sections(page).getByRole('button', { name: 'Contacts' }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  await page.reload();
  await showHub(page, member());
  await expect(current(page)).toHaveText('Contacts');
  await page.goBack();
  await expect(current(page)).toHaveText('Calendar');
});
