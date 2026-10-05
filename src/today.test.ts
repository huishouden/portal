import { afterEach, describe, expect, it } from 'bun:test';
import { setLangForTests } from '@huishouden/pwa-kit/i18n';
import type { AgendaItem } from '@huishouden/pwa-kit/agenda';
import fixture from './__fixtures__/agenda.json';
import doneFixture from './__fixtures__/today-done.json';
import { APPS } from './apps';
import { appSummaries, doneLine, todayBoard } from './today';

const local = (s: string) => new Date(s).getTime();
const items = fixture.items.map((i) => ({
  ...i,
  start: local(i.start),
  ...('end' in i && i.end ? { end: local(i.end) } : {}),
  url: `https://huishouden-${i.app}.web.app/`,
  updatedAt: 0,
  by: 'sam@example.com',
})) as AgendaItem[];

describe('per-app summary lines', () => {
  it('counts overdue and this week per app, in the household order, leaving out done, past and unknown apps', () => {
    const lines = appSummaries(items, APPS, local(fixture.now)).map((s) => ({ app: s.app.repo, overdue: s.overdue, week: s.week }));
    expect(lines).toEqual(fixture.expected);
  });
});

describe("today's board", () => {
  const now = local(doneFixture.now);
  const agenda = doneFixture.items.map((i) => ({
    ...i,
    start: local(i.start),
    ...('end' in i && i.end ? { end: local(i.end) } : {}),
    updatedAt: local(i.updatedAt),
    url: `https://huishouden-${i.app}.web.app/`,
  })) as AgendaItem[];
  const board = todayBoard(agenda, now);

  it('keeps what needs doing apart from what is done, leaving out ongoing spans like a medicine course', () => {
    expect(board.open.map((e) => ({ id: e.item.id, group: e.group as string }))).toEqual(doneFixture.expected.open);
  });

  it("lists today's done items and those marked done today, most recent first, with who and when", () => {
    const done = board.done.map((e) => ({ id: e.item.id, line: doneLine(e.item, now, doneFixture.me, doneFixture.profiles) }));
    expect(done).toEqual(doneFixture.expected.done);
  });
});

describe('who did it, in Spanish and Dutch', () => {
  // Back to English, keeping the app's catalogue (resetI18nForTests would drop it for later files).
  afterEach(() => setLangForTests('en'));
  const now = new Date(2026, 9, 1, 9, 0).getTime();
  const item = { by: 'alex@example.com', updatedAt: new Date(2026, 9, 1, 8, 12).getTime() };
  const profiles = { 'alex@example.com': { name: 'Alex Example' } };

  it('reads as a whole sentence', async () => {
    await setLangForTests('es', ['es-MX']);
    expect(doneLine(item, now, 'sam@example.com', profiles)).toMatch(/^Hecho por Alex · 8:12/);
    expect(doneLine({ ...item, by: 'sam@example.com' }, now, 'sam@example.com', profiles)).toMatch(/^Hecho por ti · /);
    await setLangForTests('nl', ['nl-NL']);
    expect(doneLine(item, now, 'sam@example.com', profiles)).toBe('Gedaan door Alex · 8:12');
  });
});
