import { expect, test, type Page } from '@playwright/test';
import { useTestHousehold } from '@huishouden/pwa-kit/e2e';
import type { TestRole } from '@huishouden/pwa-kit/staging';

// "In your own calendar" on staging, against the real calendar Worker (huishouden-calendar-staging),
// the staging Firestore and its rules: every test here is @staging, the emulators have no Worker.
// The feed each person of the run's own household gets is fetched and read: a helper's has no bills
// and no Health, a member who isn't the Health person's carer gets no Health, and the admin (in the
// audience) gets Health without its detail until they ask for it. Invented data.
const hh = useTestHousehold(test);
const staging = { tag: '@staging' };
const DAY = 86_400_000;

// After the household's own seed (useTestHousehold's beforeAll runs first): the audience and `by`
// are its people, whose emails are known only once the file runs.
test.beforeAll(async () => {
  const now = Date.now();
  const tomorrow = new Date(now + DAY);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const admin = hh.users.admin.email;
  await hh.write({
    'agenda/e2e_calendar_home': {
      app: 'home', ref: 'event:e2e-bins', kind: 'other', title: 'E2E garbage pickup', start: tomorrow.getTime() + 7 * 3_600_000, allDay: false, detail: 'Every week',
      url: 'https://huishouden-staging.web.app/home/', private: false, updatedAt: now, by: admin,
    },
    'agenda/e2e_calendar_bill': {
      app: 'bills', ref: 'bill:e2e-power', kind: 'bill', title: 'E2E power bill', start: tomorrow.getTime() + 2 * DAY, allDay: true, detail: '€84.10',
      url: 'https://huishouden-staging.web.app/bills/', status: 'upcoming', private: true, updatedAt: now, by: admin,
    },
    'personalAgenda/e2e_calendar_health': {
      app: 'health', ref: 'dose:e2e-nan:1', kind: 'medicine', title: 'Medicine for E2E Nan', start: tomorrow.getTime() + 8 * 3_600_000, allDay: false, detail: 'E2E Amoxicillin 250 mg', who: 'E2E Nan',
      url: 'https://huishouden-staging.web.app/health/', status: 'upcoming', private: true, audience: [admin], updatedAt: now, by: admin,
    },
  });
});

/** Signs in, opens the page and makes (or reads) the person's calendar link. */
async function feedLink(page: Page, as: TestRole): Promise<string> {
  await hh.signIn(page, as, 'my-calendar');
  await expect(page.getByRole('heading', { name: 'In your own calendar' })).toBeVisible({ timeout: 20_000 });
  const make = page.getByRole('button', { name: 'Make my calendar link' });
  const field = page.getByLabel('Your calendar link');
  await expect(make.or(field)).toBeVisible({ timeout: 20_000 });
  if (await make.isVisible()) await make.click();
  await expect(field).toBeVisible({ timeout: 20_000 });
  return field.inputValue();
}

async function feedText(page: Page, url: string): Promise<string> {
  const res = await page.request.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/calendar');
  return res.text();
}

test('a helper’s calendar has the household’s everyday things, no bills and no Health', staging, async ({ page }) => {
  const url = await feedLink(page, 'helper');
  const ics = await feedText(page, url);
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics).toContain('E2E garbage pickup');
  expect(ics).not.toContain('E2E power bill');
  expect(ics).not.toContain('E2E Nan');
  // A helper isn't offered bills at all.
  await expect(page.getByRole('checkbox', { name: 'Bills' })).toHaveCount(0);
});

test('a member who isn’t the carer sees bills but no Health', staging, async ({ page }) => {
  const ics = await feedText(page, await feedLink(page, 'member'));
  expect(ics).toContain('E2E power bill');
  expect(ics).not.toContain('E2E Nan');
});

test('the admin in Health’s audience: "Medicine for E2E Nan" with no detail until they ask; then a new link, then none', staging, async ({ page }) => {
  const url = await feedLink(page, 'admin');
  let ics = await feedText(page, url);
  expect(ics).toContain('Medicine for E2E Nan');
  expect(ics).not.toContain('Amoxicillin');

  const detail = page.getByRole('checkbox', { name: 'Health details' });
  await expect(detail).not.toBeChecked();
  await detail.check();
  await expect.poll(async () => (await feedText(page, url)).includes('E2E Amoxicillin'), { timeout: 20_000 }).toBe(true);
  await detail.uncheck();
  await expect.poll(async () => (await feedText(page, url)).includes('Amoxicillin'), { timeout: 20_000 }).toBe(false);

  await page.getByRole('button', { name: 'Get a new link' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Get a new link' }).click();
  await expect(page.getByLabel('Your calendar link')).not.toHaveValue(url, { timeout: 20_000 });
  expect((await page.request.get(url)).status()).toBe(404);
  const fresh = await page.getByLabel('Your calendar link').inputValue();
  ics = await feedText(page, fresh);
  expect(ics).toContain('E2E garbage pickup');

  await page.getByRole('button', { name: 'Turn off the link' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Turn off the link' }).click();
  await expect(page.getByRole('button', { name: 'Make my calendar link' })).toBeVisible({ timeout: 20_000 });
  expect((await page.request.get(fresh)).status()).toBe(404);
});
