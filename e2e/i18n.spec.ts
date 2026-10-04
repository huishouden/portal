import { expect, test, type Page } from '@playwright/test';
import { expectLocalized, useLanguage } from '@huishouden/pwa-kit/e2e';
import type { TodoItem } from '@huishouden/pwa-kit/todos';
import es from '../src/locales/es.json' with { type: 'json' };
import nl from '../src/locales/nl.json' with { type: 'json' };
import { member, showHub, todos } from './fixtures/hub';
import { TODO_NOW } from '../src/__fixtures__/todos';

// The hub in Spanish and Dutch: signed out (tiles and the introduction), then an invented member's
// screens (window.__hubPreview). Item titles, names and notes are household data and stay as entered.
const ENGLISH = [
  'Simple shared apps for running a home together',
  'How it works',
  'Sign in with Google',
  'Tasks',
  'Groceries',
  'Health',
  'Bills',
  'Spending',
  'Shared to-dos and chores',
  'Good morning',
];

const MESSAGES = { es, nl } as const;
const TILE_NAMES = { es: ['Tareas', 'Compras', 'Salud'], nl: ['Taken', 'Boodschappen', 'Gezondheid'] } as const;

/** The Water bill to-do as Bills writes it now: its words in every language (localizeTodos). */
const translated: TodoItem[] = todos.map((i) =>
  i.ref === 'bill:water'
    ? {
        ...i,
        texts: {
          en: { title: 'Water bill', done: 'Mark paid', cancel: 'Skip' },
          es: { title: 'Factura del agua', done: 'Marcar pagada', cancel: 'Omitir' },
          nl: { title: 'Waterrekening', done: 'Betaald', cancel: 'Overslaan' },
        },
      }
    : i,
);

/** Opens a member's tab directly (its path), then hands the hub the invented member. */
const openAs = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: 'networkidle' });
  await showHub(page, member({ todos: translated }));
};

for (const lang of ['es', 'nl'] as const) {
  const m = MESSAGES[lang];

  test(`signed out in ${lang}: tiles, introduction and the Dutch word`, async ({ page }) => {
    await page.clock.setFixedTime('2026-10-01T09:00:00');
    // "Privacy" is the Dutch word too.
    await expectLocalized(page, lang, { words: ENGLISH, allow: lang === 'nl' ? ['Privacy'] : [] });
    const tiles = page.getByRole('navigation', { name: m['tiles.label'] });
    for (const name of TILE_NAMES[lang]) await expect(tiles.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible();
    await expect(page.locator('#household').getByRole('heading', { name: m['intro.title'] })).toBeVisible();
    await page.locator('#household').getByRole('button', { name: 'Huishouden', exact: true }).click();
    await expect(page.getByText(m['dutch.means'].replace('{means}', m['dutch.huishoudenMeans']))).toBeVisible();
    await expect(page.getByRole('link', { name: m['privacy.link'], exact: true })).toBeVisible();
  });

  test(`a member's hub in ${lang}: Today, To-do, Apps and the currency`, async ({ page }) => {
    await page.clock.setFixedTime(TODO_NOW);
    await useLanguage(page, lang);
    await openAs(page, '/today');
    await expect(page.getByRole('region', { name: m['today.byApp'] })).toBeVisible();
    await expect(page.getByText(m['today.doneToday'].replace('{count}', '2'))).toBeVisible();

    await openAs(page, '/todo');
    await expect(page.getByRole('heading', { name: m['todo.title'], level: 2 })).toBeVisible();
    const water = page.getByRole('listitem', { name: lang === 'es' ? 'Factura del agua' : 'Waterrekening', exact: true });
    await expect(water.getByRole('button', { name: new RegExp(`^${lang === 'es' ? 'Marcar pagada' : 'Betaald'}:`) })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);

    await openAs(page, '/apps');
    const household = page.locator('#household');
    await expect(household.getByRole('button', { name: m['household.invite'], exact: true })).toBeVisible();
    const currency = household.getByLabel(m['currency.label']);
    await currency.selectOption('EUR');
    await expect(currency).toHaveValue('EUR');
    await expect(household.getByText(/€/)).toBeVisible();

    await page.getByRole('button', { name: m['food.addSomeone'] }).click();
    const dialog = page.getByRole('dialog', { name: m['food.newPersonTitle'] });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: lang === 'es' ? 'Guardar' : 'Opslaan', exact: true })).toBeVisible();
  });
}
