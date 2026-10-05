import { expect, test, type Page } from '@playwright/test';
import { useTestHousehold } from '@huishouden/pwa-kit/e2e';

// Connect Google Calendar when Google's window goes wrong, with Google Identity Services stubbed:
// its code client either can't open the window (a blocked pop-up) or opens one that never answers
// (a window out of sight); in redirect mode ("Continue in this tab") it plays Google sending the
// person back with a code. The calendar Worker is stubbed too ("Google offered, not connected", and
// the connect call), so nothing reaches Google or the Worker. On staging: the emulator build has no Worker.
const hh = useTestHousehold(test);
const staging = { tag: '@staging' };

async function stubGoogle(page: Page, mode: 'blocked' | 'hidden') {
  await page.addInitScript((mode) => {
    const w = window as unknown as { google: unknown; __codeRequests: number };
    w.__codeRequests = 0;
    w.google = {
      accounts: {
        id: { initialize() {}, prompt() {}, disableAutoSelect() {} },
        oauth2: {
          initCodeClient: (cfg: { ux_mode: string; redirect_uri?: string; state?: string; scope: string; error_callback?: (e: { type: string; message: string }) => void }) => ({
            requestCode() {
              if (cfg.ux_mode === 'redirect') {
                // Google's page, then back to the app's page with a one-time code.
                location.assign(`${cfg.redirect_uri}?state=${cfg.state}&code=4%2F0-redirect-code&scope=${encodeURIComponent(cfg.scope)}&authuser=0&prompt=consent`);
                return;
              }
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
  await page.route('**/api/status?**', (route) =>
    route.fulfill({ json: { feed: null, signedOut: false, googleAvailable: true, google: null, lastError: null }, headers: { 'Access-Control-Allow-Origin': '*' } }),
  );
}

async function connect(page: Page) {
  await hh.signIn(page, 'member', 'my-calendar');
  const button = page.getByRole('button', { name: 'Connect Google Calendar' });
  await expect(button).toBeVisible({ timeout: 20_000 });
  await button.click();
  return button;
}

test('a blocked Google window says so: allow pop-ups, and the button is ready again', staging, async ({ page }) => {
  await stubGoogle(page, 'blocked');
  const button = await connect(page);
  await expect(page.getByText('Your browser blocked Google’s window. Allow pop-ups for this site, or use Continue in this tab.')).toBeVisible();
  await expect(button).toBeEnabled();
});

test('Continue in this tab: Google’s page here, back to the page, and connected with that page’s code', staging, async ({ page }) => {
  await stubGoogle(page, 'blocked');
  const sent: Record<string, unknown>[] = [];
  await page.route('**/api/google/connect', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    sent.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      json: { feed: null, signedOut: false, googleAvailable: true, lastError: null, google: { account: 'e2e-calendar@example.com', connectedAt: Date.now(), lastSync: null, lastOk: null, error: null, notice: null, counts: null } },
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  await connect(page);
  await page.getByRole('button', { name: 'Continue in this tab' }).click();
  await expect(page.getByText('e2e-calendar@example.com')).toBeVisible({ timeout: 20_000 });
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ code: '4/0-redirect-code', redirectUri: new URL('my-calendar', page.url()).href });
  // The one-time code is gone from the address.
  expect(new URL(page.url()).search).toBe('');
});

test('a Google window out of sight: after a few seconds, a way to bring it back', staging, async ({ page }) => {
  await stubGoogle(page, 'hidden');
  await connect(page);
  await expect(page.getByText('Can’t see it? It may be behind this window, or continue in this tab instead.')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue in this tab' })).toBeVisible();
  await page.getByRole('button', { name: 'Show Google’s window' }).click();
  expect(await page.evaluate(() => (window as unknown as { __codeRequests: number }).__codeRequests)).toBe(2);
});
