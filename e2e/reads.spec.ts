import { expect, test } from '@playwright/test';
import { expectPageReads, useTestHousehold } from '@huishouden/pwa-kit/e2e';

// Read budgets (pwa-kit STANDARD.md "Read budgets"): what opening the portal costs a household in
// Firestore reads, on the emulators with a build that counts them (`expectPageReads`), in a fresh
// browser context (a first open, nothing cached). A change that raises a ceiling says why in its PR.
// A household with some of the week in it (invented): five agenda items and three open to-dos.
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
const hh = useTestHousehold(test, { docs: { ...agenda, ...todos } });

test('the start screen (Today), signed in as an admin', async ({ page }) => {
  await expectPageReads(
    page,
    async () => {
      await hh.signIn(page, 'admin');
      await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Today' })).toBeVisible({ timeout: 20_000 });
    },
    { max: 17, label: 'portal, Today' },
  );
});
