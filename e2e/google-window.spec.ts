import { expect, test, type Page } from '@playwright/test';
import { useTestHousehold } from '@huishouden/pwa-kit/e2e';

// Connect Google Calendar when Google's window goes wrong, with Google Identity Services stubbed:
// its code client either can't open the window (a blocked pop-up) or opens one that never answers
// (a window out of sight). The calendar Worker's status is stubbed too, "Google offered, not
// connected", so nothing reaches Google or the Worker. On staging: the emulator build has no Worker.
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
  await expect(page.getByText('Your browser blocked Google’s window. Allow pop-ups for this site, then try again.')).toBeVisible();
  await expect(button).toBeEnabled();
});

test('a Google window out of sight: after a few seconds, a way to bring it back', staging, async ({ page }) => {
  await stubGoogle(page, 'hidden');
  await connect(page);
  await expect(page.getByText('Can’t see it? It may be behind this window.')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Show Google’s window' }).click();
  expect(await page.evaluate(() => (window as unknown as { __codeRequests: number }).__codeRequests)).toBe(2);
});
