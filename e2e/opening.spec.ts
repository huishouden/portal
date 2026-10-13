import { test } from '@playwright/test';
import { expectOpeningLinesUp } from '@huishouden/pwa-kit/e2e';
import { MEMBER_HINT } from '../src/memberHint';
import { member, showHub } from './fixtures/hub';

// While the hub opens it shows the kit's opening frame (AppOpening): the same app bar, tabs and
// column as the loaded hub, so nothing jumps when it arrives (kit STANDARD.md "Updates").

test('a new device: the opening frame lines up with the signed-out hub, neither with tabs', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  await expectOpeningLinesUp(browser, { baseURL, path: '/', tabs: 'none' });
});

// A device that remembers a member opens with the member's tabs; E2E can't sign in, so the loaded
// side is the same member handed to the hub as a preview (window.__hubPreview).
test("a remembered member: the opening frame's tabs line up with the member's hub", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  await expectOpeningLinesUp(browser, {
    baseURL,
    path: '/today',
    prepare: async (p) => {
      await p.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ household: 'h1' })), MEMBER_HINT);
    },
    loaded: (p) => showHub(p, member()),
  });
});
