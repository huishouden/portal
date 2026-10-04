import { afterEach, describe, expect, it } from 'bun:test';
import { setLangForTests } from '@huishouden/pwa-kit/i18n';
import registry from '../apps.json';
import './i18n';
import fixtures from './__fixtures__/portal-layouts.json';
import { APPS, appHref, contactRoleLabel, arrangeTiles, layoutOf, parseLayout, sameLayout, suiteLink, tilesFrom, type RegistryEntry } from './apps';

const repos = (apps: { repo: string }[]) => apps.map((a) => a.repo);

describe('default order', () => {
  it('starts with the everyday apps, then Spending, then Baby', () => {
    expect(APPS.map((a) => a.name).slice(0, 9)).toEqual(['Tasks', 'Groceries', 'Home', 'Pet', 'Health', 'Car', 'Bills', 'Spending', 'Baby']);
  });

  it('keeps the portal first in the registry and off the tiles', () => {
    expect(registry[0].repo).toBe('portal');
    expect(repos(APPS)).not.toContain('portal');
  });

  it('is the registry order when the household has no layout', () => {
    const { shown, more } = arrangeTiles(APPS);
    expect(repos(shown)).toEqual(repos(tilesFrom(registry as RegistryEntry[])));
    expect(more).toEqual([]);
  });
});

describe('a household layout', () => {
  it('puts tiles in its order and moves hidden apps under More apps', () => {
    const { shown, more } = arrangeTiles(APPS, parseLayout(fixtures.saved));
    expect(repos(shown)).toEqual(['pet', 'tasks', 'home', 'car', 'bills', 'groceries', 'health']);
    expect(repos(more)).toEqual(['spending', 'baby']);
  });

  it('shows apps it never placed after its own, in registry order', () => {
    const { all } = arrangeTiles(APPS, parseLayout(fixtures.beforeNewApps));
    expect(repos(all)).toEqual(['home', 'tasks', 'groceries', 'pet', 'health', 'car', 'bills', 'spending', 'baby']);
  });

  it('ignores malformed entries and apps no longer in the registry', () => {
    const layout = parseLayout(fixtures.malformed);
    expect(layout).toEqual({ order: ['home', 'retired-app'], hidden: [] });
    expect(repos(arrangeTiles(APPS, layout).all)[0]).toBe('home');
    expect(arrangeTiles(APPS, layout).all).toHaveLength(APPS.length);
  });

  it('reads a missing document as the default', () => {
    expect(parseLayout(undefined)).toEqual({ order: [], hidden: [] });
  });

  it('saves every app in order, and only hidden apps that exist', () => {
    const layout = layoutOf(APPS, ['baby', 'retired-app']);
    expect(layout.order).toEqual(repos(APPS));
    expect(layout.hidden).toEqual(['baby']);
  });

  it('compares hidden apps regardless of order', () => {
    expect(sameLayout({ order: ['a', 'b'], hidden: ['x', 'y'] }, { order: ['a', 'b'], hidden: ['y', 'x'] })).toBe(true);
    expect(sameLayout({ order: ['a', 'b'], hidden: [] }, { order: ['b', 'a'], hidden: [] })).toBe(false);
  });
});

describe('one site (pwa-kit docs/one-site.md)', () => {
  const entries: RegistryEntry[] = [
    { name: 'Huishouden', repo: 'portal', site: 'example-family', path: '/', glyph: 'home', tile: false },
    { name: 'Pet', repo: 'pet', site: 'example-pet', path: '/pet/', redirect: true, glyph: 'paw' },
    { name: 'Baby', repo: 'baby', site: 'example-baby', path: '/baby/', glyph: 'bottle' },
  ];

  it('a moved app opens at its path; one not yet moved at its own site', () => {
    expect(appHref(entries[1])).toBe('/pet/');
    expect(appHref(entries[2])).toBe('https://example-baby.web.app/');
  });

  it("stored links to a moved app's old address or the shared site open on this site", () => {
    expect(suiteLink('https://example-pet.web.app/?tab=care&pet=p1', entries)).toBe('/pet/?tab=care&pet=p1');
    expect(suiteLink('https://example-pet.web.app/meds/c1#x', entries)).toBe('/pet/meds/c1#x');
    expect(suiteLink('https://example-family.web.app/pet/?tab=care', entries)).toBe('/pet/?tab=care');
    expect(suiteLink('https://example-baby.web.app/#appointments', entries)).toBe('https://example-baby.web.app/#appointments');
    expect(suiteLink('https://example-pet.web.app.evil.example.com/', entries)).toBe('https://example-pet.web.app.evil.example.com/');
    expect(suiteLink('not a url', entries)).toBe('not a url');
  });
});

describe('in another language', () => {
  // Back to English, keeping the app's catalogue (resetI18nForTests would drop it for later files).
  afterEach(() => setLangForTests('en'));

  it('tiles read their name and description in it, and follow a change', async () => {
    const tasks = APPS.find((a) => a.repo === 'tasks')!;
    expect([tasks.name, tasks.description]).toEqual(['Tasks', 'Shared to-dos and chores']);
    await setLangForTests('es');
    expect([tasks.name, tasks.description]).toEqual(['Tareas', 'Pendientes y tareas compartidas']);
    await setLangForTests('nl');
    expect(tasks.name).toBe('Taken');
  });

  it('every tile has a name and description in Spanish and Dutch', () => {
    for (const e of (registry as RegistryEntry[]).filter((a) => a.tile !== false)) {
      for (const lang of ['es', 'nl'] as const) {
        expect(e.i18n?.[lang]?.name, `${e.repo} ${lang}`).toBeTruthy();
        expect(e.i18n?.[lang]?.description, `${e.repo} ${lang}`).toBeTruthy();
        expect(Object.keys(e.i18n?.[lang]?.contactRoles ?? {}).sort(), `${e.repo} ${lang}`).toEqual([...(e.contactRoles ?? [])].sort());
      }
    }
  });

  it("shows an app's contact roles in it; typed ones stay as typed", async () => {
    expect(contactRoleLabel('Plumber')).toBe('Plumber');
    await setLangForTests('es');
    expect(contactRoleLabel('Plumber')).toBe('Plomero');
    expect(contactRoleLabel('Landlord')).toBe('Arrendador');
    expect(contactRoleLabel('Night nanny')).toBe('Night nanny');
    await setLangForTests('nl');
    expect(contactRoleLabel('Vet')).toBe('Dierenarts');
  });
});
