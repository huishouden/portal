import { expect, test, type Page } from '@playwright/test';
import { signInTestUser } from '@huishouden/pwa-kit/e2e';
import { seedTestHousehold, STAGING_PROJECT, testHousehold } from '@huishouden/pwa-kit/staging';

const TEST_HOUSEHOLD = testHousehold();
import { encodeFields } from '@huishouden/pwa-kit/firestore-rest';

// "In your own calendar" on staging, against the real calendar Worker (huishouden-calendar-staging),
// the staging Firestore and its rules. The feed each test user gets is fetched and read: a helper's
// has no bills and no Health, a member who isn't the Health person's carer gets no Health, and the
// admin (in the audience) gets Health without its detail until they ask for it. Invented data.
test.skip(!process.env.HH_STAGING_SA, 'signed-in tests run against staging, in CI');

const H = `projects/${STAGING_PROJECT}/databases/(default)/documents/households/${TEST_HOUSEHOLD.id}`;
const DAY = 86_400_000;

async function seedAgenda(accessToken: string) {
  const now = Date.now();
  const tomorrow = new Date(now + DAY);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const docs: Record<string, Record<string, unknown>> = {
    'agenda/e2e_calendar_home': {
      app: 'home', ref: 'event:e2e-bins', kind: 'other', title: 'E2E garbage pickup', start: tomorrow.getTime() + 7 * 3_600_000, allDay: false, detail: 'Every week',
      url: 'https://huishouden-staging.web.app/home/', private: false, updatedAt: now, by: 'test-a@example.com',
    },
    'agenda/e2e_calendar_bill': {
      app: 'bills', ref: 'bill:e2e-power', kind: 'bill', title: 'E2E power bill', start: tomorrow.getTime() + 2 * DAY, allDay: true, detail: '€84.10',
      url: 'https://huishouden-staging.web.app/bills/', status: 'upcoming', private: true, updatedAt: now, by: 'test-a@example.com',
    },
    'personalAgenda/e2e_calendar_health': {
      app: 'health', ref: 'dose:e2e-nan:1', kind: 'medicine', title: 'Medicine for E2E Nan', start: tomorrow.getTime() + 8 * 3_600_000, allDay: false, detail: 'E2E Amoxicillin 250 mg', who: 'E2E Nan',
      url: 'https://huishouden-staging.web.app/health/', status: 'upcoming', private: true, audience: ['test-a@example.com'], updatedAt: now, by: 'test-a@example.com',
    },
  };
  const writes = Object.entries(docs).map(([path, data]) => ({ update: { name: `${H}/${path}`, fields: encodeFields(data) } }));
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${STAGING_PROJECT}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) throw new Error(`seeding the agenda: ${res.status} ${await res.text()}`);
}

test.beforeAll(async () => {
  await seedTestHousehold({ accessToken: process.env.HH_STAGING_ACCESS_TOKEN! });
  await seedAgenda(process.env.HH_STAGING_ACCESS_TOKEN!);
});

/** Signs in, opens the page and makes (or reads) the person's calendar link. */
async function feedLink(page: Page, email: string): Promise<string> {
  await signInTestUser(page, { email });
  await page.goto('my-calendar');
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

test('a helper’s calendar has the household’s everyday things, no bills and no Health', async ({ page }) => {
  const url = await feedLink(page, 'test-helper@example.com');
  const ics = await feedText(page, url);
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics).toContain('E2E garbage pickup');
  expect(ics).not.toContain('E2E power bill');
  expect(ics).not.toContain('E2E Nan');
  // A helper isn't offered bills at all.
  await expect(page.getByRole('checkbox', { name: 'Bills' })).toHaveCount(0);
});

test('a member who isn’t the carer sees bills but no Health', async ({ page }) => {
  const ics = await feedText(page, await feedLink(page, 'test-b@example.com'));
  expect(ics).toContain('E2E power bill');
  expect(ics).not.toContain('E2E Nan');
});

test('the admin in Health’s audience: "Medicine for E2E Nan" with no detail until they ask; then a new link, then none', async ({ page }) => {
  const url = await feedLink(page, 'test-a@example.com');
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

// Google's window, stubbed: a stand-in for Google Identity Services whose code client either can't
// open its window (a blocked pop-up) or opens one that never answers (a window out of sight). The
// Worker's status is the real one with Google offered and not yet connected.
async function stubGoogle(page: Page, mode: 'blocked' | 'hidden') {
  await page.addInitScript((mode) => {
    const w = window as unknown as { google: unknown; __codeRequests: number };
    w.__codeRequests = 0;
    w.google = {
      accounts: {
        id: { initialize() {}, prompt() {}, disableAutoSelect() {} },
        oauth2: {
          initCodeClient: (cfg: { error_callback?: (e: { type: string; message: string }) => void }) => ({
            requestCode() {
              w.__codeRequests += 1;
              if (mode === 'blocked') setTimeout(() => cfg.error_callback?.({ type: 'popup_failed_to_open', message: 'Failed to open popup window' }));
            },
          }),
          initTokenClient: () => ({ requestAccessToken() {} }),
          hasGrantedAllScopes: () => false,
        },
      },
    };
  }, mode);
  await page.route('**/api/status?**', async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: { ...body, googleAvailable: true, google: null } });
  });
}

test('a blocked Google window says so: allow pop-ups, and the button is ready again', async ({ page }) => {
  await stubGoogle(page, 'blocked');
  await signInTestUser(page, { email: 'test-b@example.com' });
  await page.goto('my-calendar');
  const connect = page.getByRole('button', { name: 'Connect Google Calendar' });
  await expect(connect).toBeVisible({ timeout: 20_000 });
  await connect.click();
  await expect(page.getByText('Your browser blocked Google’s window. Allow pop-ups for this site, then try again.')).toBeVisible();
  await expect(connect).toBeEnabled();
});

test('a Google window out of sight: after a few seconds, a way to bring it back', async ({ page }) => {
  await stubGoogle(page, 'hidden');
  await signInTestUser(page, { email: 'test-b@example.com' });
  await page.goto('my-calendar');
  const connect = page.getByRole('button', { name: 'Connect Google Calendar' });
  await expect(connect).toBeVisible({ timeout: 20_000 });
  await connect.click();
  await expect(page.getByText('Can’t see it? It may be behind this window.')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Show Google’s window' }).click();
  expect(await page.evaluate(() => (window as unknown as { __codeRequests: number }).__codeRequests)).toBe(2);
});
