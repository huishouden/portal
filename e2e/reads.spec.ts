import { expect, test } from '@playwright/test';
import { expectPageReads, useTestHousehold } from '@huishouden/pwa-kit/e2e';

// Read budgets (pwa-kit STANDARD.md "Read budgets"): what opening the portal costs a household in
// Firestore reads, on the emulators with a build that counts them (`expectPageReads`), in a fresh
// browser context (a first open, nothing cached). A change that raises a ceiling says why in its PR.
// A household with some of the week in it (invented): five agenda items and three open to-dos, and
// a private bill and to-do an admin sees and a helper must not.
const NOW = Date.now();
const DAY = 86_400_000;
const site = 'https://example.test';
const agenda = Object.fromEntries(
  ['Garbage pickup', 'Vet visit', 'Water bill due', 'Swimming lesson', 'Dentist'].map((title, i) => [
    `agenda/pet_appointment_r${i}`,
    { app: 'pet', ref: `appointment:r${i}`, kind: 'appointment', title, start: NOW + (i + 1) * DAY, allDay: true, url: `${site}/pet/`, private: false, updatedAt: NOW, by: 'seed@example.com' },
  ]),
);
const todos = Object.fromEntries(
  ['Buy paint', 'Book a plumber', 'Return library books'].map((title, i) => [
    `todos/home:job:r${i}`,
    { app: 'home', ref: `job:r${i}`, title, createdAt: NOW - DAY, url: `${site}/home/`, status: 'open', private: false, updatedAt: NOW, by: 'seed@example.com' },
  ]),
);
// What a helper must never read: a money item and a private to-do.
const hidden = {
  'agenda/bills_bill_r9': { app: 'bills', ref: 'bill:r9', kind: 'bill', title: 'Electricity bill', start: NOW + 2 * DAY, allDay: true, url: `${site}/bills/`, private: true, updatedAt: NOW, by: 'seed@example.com' },
  'todos/home:job:r9': { app: 'home', ref: 'job:r9', title: 'Plan the surprise party', createdAt: NOW - DAY, url: `${site}/home/`, status: 'open', private: true, updatedAt: NOW, by: 'seed@example.com' },
};
const hh = useTestHousehold(test, { docs: { ...agenda, ...todos, ...hidden } });

test('the start screen (Today), signed in as an admin', async ({ page }) => {
  await expectPageReads(
    page,
    async () => {
      await hh.signIn(page, 'admin');
      await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Today' })).toBeVisible({ timeout: 20_000 });
    },
    { max: 19, min: 19, label: 'portal, Today' },
  );
  // What the helper must not see is on the admin's screen, so its absence there measures the role.
  await expect(page.getByText('Electricity bill').first()).toBeVisible();
});

// The always-on screen is often a helper's: restricted queries (private == false), no money.
test('the start screen (Today), signed in as a helper: nothing private read', async ({ page }) => {
  await expectPageReads(
    page,
    async () => {
      await hh.signIn(page, 'helper');
      await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Today' })).toBeVisible({ timeout: 20_000 });
    },
    { max: 17, min: 17, label: 'portal, Today, helper' },
  );
  // The helper's agenda did load (a refused listener would also show nothing, and read less: `min`);
  // the private to-do isn't on Today, and its read is what the helper's two fewer reads leave out.
  await expect(page.getByText('Vet visit').first()).toBeVisible();
  await expect(page.getByText('Electricity bill')).toHaveCount(0);
});
