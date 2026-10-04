import { expect, test } from '@playwright/test';
import { stubOpenStreetMap, useGeolocation } from '@huishouden/pwa-kit/e2e';
import { readFileSync } from 'node:fs';
import { contacts, helper, household, member, showHub } from './fixtures/hub';

// The household's home in the Household panel (@huishouden/pwa-kit/home): found by address search or
// from the device's location, with OpenStreetMap stubbed (invented answers, grey tiles), on the
// preview hub (window.__hubPreview), so nothing reaches Firestore or Nominatim.
const osm = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/osm/${name}.json`, import.meta.url), 'utf8'));

const HOME = { address: '12 Example Lane, Springfield, Illinois 62701', lat: 39.7817, lng: -89.6501, placeId: 'way/424242', timeZone: 'America/Chicago', setBy: 'sam@example.com', updatedAt: 1 };

test('a member finds the address by search, sees it on the map and saves it', async ({ page }) => {
  const asked = await stubOpenStreetMap(page, { search: osm('search') });
  await page.goto('/apps', { waitUntil: 'networkidle' });
  await showHub(page, member());
  const panel = page.locator('#household');
  await expect(panel.getByRole('heading', { name: 'Home' })).toBeVisible();
  await panel.getByPlaceholder('Street, town').fill('12 Example Lane Springfield');
  await panel.getByRole('button', { name: 'Search' }).click();
  const found = panel.getByRole('list', { name: 'Addresses found' });
  await expect(found.getByRole('button')).toHaveCount(2);
  await found.getByRole('button', { name: /Illinois/ }).click();
  await expect(panel.getByRole('img', { name: 'Map of 12 Example Lane, Springfield, Illinois 62701' })).toBeVisible();
  await expect(panel.getByRole('link', { name: '© OpenStreetMap contributors' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  await panel.getByRole('button', { name: 'Save as home' }).click();
  await expect(panel.getByTestId('home-address')).toHaveText('12 Example Lane, Springfield, Illinois 62701');
  await expect(panel).toContainText('Set by Sam Example');
  await expect(panel.getByRole('button', { name: 'Change' })).toBeVisible();
  // Nominatim was asked once, for the search, with addresses broken down.
  expect(asked).toHaveLength(1);
  expect(new URL(asked[0]).searchParams.get('addressdetails')).toBe('1');
});

test("a member uses the device's location, only the neighbourhood", async ({ page, context, baseURL }) => {
  await stubOpenStreetMap(page, { reverse: osm('reverse'), area: osm('area') });
  await useGeolocation(context, { lat: 39.781705, lng: -89.650115 }, new URL(baseURL!).origin);
  await page.goto('/apps', { waitUntil: 'networkidle' });
  await showHub(page, member());
  const panel = page.locator('#household');
  await panel.getByRole('button', { name: 'Use my current location' }).click();
  await expect(panel.getByTestId('home-picked')).toContainText('12 Example Lane, Springfield');
  await panel.getByText('Approximate only', { exact: true }).click();
  await panel.getByRole('button', { name: 'Save as home' }).click();
  await expect(panel.getByTestId('home-address')).toHaveText('Riverside, Springfield, Illinois');
  await expect(panel).toContainText('Approximate: the neighbourhood, not the house');
});

test('a helper sees the address and the map, and cannot change it', async ({ page }) => {
  await stubOpenStreetMap(page);
  await page.goto('/apps', { waitUntil: 'networkidle' });
  const state = helper();
  await showHub(page, { ...state, household: { ...(state as { household: typeof household }).household, home: HOME } } as typeof state);
  const panel = page.locator('#household');
  await expect(panel.getByTestId('home-address')).toHaveText(HOME.address);
  await expect(panel.getByRole('img', { name: `Map of ${HOME.address}` })).toBeVisible();
  await expect(panel).toContainText('Admins and members can change it.');
  await expect(panel.getByRole('button', { name: 'Change' })).toHaveCount(0);
});

test('contacts with a place on the map say how far they are from home', async ({ page }) => {
  await stubOpenStreetMap(page);
  await page.goto('/contacts', { waitUntil: 'networkidle' });
  const vet = { ...contacts[0], lat: 39.7817, lng: -89.6066 };
  await showHub(page, member({ household: { ...household, home: HOME }, contacts: [vet, ...contacts.slice(1)] }));
  await expect(page.getByRole('region', { name: vet.name })).toContainText('2.3 mi from home');
});
