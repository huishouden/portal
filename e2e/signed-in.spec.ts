import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectBottomNav, useTestHousehold } from '@huishouden/pwa-kit/e2e';

// Signed in as the invented people of a household of this run's own (pwa-kit STANDARD.md
// "Staging"), against the real rules: on the emulators (app-tests, `bun run e2e:emulator`), and on
// staging for what needs the one site (@staging) or a kit bump (@smoke).
const hh = useTestHousehold(test);

const appsTab = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Apps' }).click();

test('the admin sees each member’s role and can change it', { tag: '@smoke' }, async ({ page }) => {
  await hh.signIn(page, 'admin');
  await appsTab(page);
  const { email, name } = hh.users.helper;
  await expect(page.getByLabel(`Role for ${email}`).or(page.getByLabel(`Role for ${name}`))).toHaveValue('helper', { timeout: 20_000 });
  await expect(page.getByRole('link', { name: /Spending/ })).toBeVisible();
});

test('a helper is told who manages people, sees no money, and can add a contact of their own', async ({ page }) => {
  await hh.signIn(page, 'helper');
  await appsTab(page);
  // Refused: managing people and roles, settings, money.
  await expect(page.getByText('Only admins can invite or remove people and set roles.')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByPlaceholder('Their Google account email')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rename' })).toHaveCount(0);
  await expect(page.getByText('Only admins and members can change settings.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Spending/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Bills/ })).toHaveCount(0);

  // Permitted: a contact of their own, which they may also delete.
  const name = 'Helper contact';
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Contacts' }).click();
  await page.getByRole('button', { name: 'Add contact' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Only admins and members')).toHaveCount(0);
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: `Delete ${name}` }).click();
  await expect(page.getByRole('region', { name })).toHaveCount(0);
});

// One site (pwa-kit docs/one-site.md): the apps share the portal's origin, so signing in here
// signs every moved app in too.
test('signed in on the portal, each moved app opens signed in', { tag: '@staging' }, async ({ page }) => {
  const registry: { repo: string; path?: string; redirect?: boolean }[] = JSON.parse(readFileSync(new URL('../apps.json', import.meta.url), 'utf8'));
  const site = (await (await page.request.get('/hh-site.json')).json()) as { apps: Record<string, unknown> };
  const moved = registry.filter((a) => a.path && a.redirect && site.apps[a.path]);
  test.skip(moved.length === 0, 'no app on this site yet');
  await hh.signIn(page, 'admin');
  const signedIn = page.locator('hh-app-bar').getByRole('button', { name: `Signed in as ${hh.users.admin.email}` });
  await expect(signedIn).toBeVisible({ timeout: 20_000 });
  for (const app of moved) {
    await page.goto(app.path!.slice(1));
    await expect(signedIn, app.repo).toBeVisible({ timeout: 20_000 });
  }
});

test('signed in on a phone, the sections are a bottom bar', async ({ page }) => {
  await hh.signIn(page, 'admin');
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Today' })).toBeVisible({ timeout: 20_000 });
  await expectBottomNav(page, { labels: ['Today', 'To-do', 'Calendar', 'Apps', 'More'], more: ['Contacts'] });
});

// The rules let the admin read every to-do and the helper the open ones (their query asks for
// them): either way the tab loads its list, never stuck loading. Each app's own staging test runs a
// real item's Done from here (runPortalTodo in @huishouden/pwa-kit/e2e).
for (const as of ['admin', 'helper'] as const) {
  test(`the ${as} opens the household's to-do list`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && /permission/i.test(m.text()) && errors.push(m.text()));
    await hh.signIn(page, as, '/todo');
    await expect(page.getByRole('heading', { name: 'To-do' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/things? to do|Nothing to do in any app/).first()).toBeVisible({ timeout: 20_000 });
    expect(errors).toEqual([]);
  });
}
