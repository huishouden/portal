import { describe, expect, test } from 'bun:test';
import { addLinks, calendarCall, CalendarCallError, toCalendarChange, undoAllowed } from './myCalendar';

const FEED = { url: 'https://huishouden-calendar.example.workers.dev/feed/abcdefghijklmnopqrstuvwx.ics', webcal: 'webcal://huishouden-calendar.example.workers.dev/feed/abcdefghijklmnopqrstuvwx.ics' };

describe('the calendar link', () => {
  test('each calendar app gets the address it takes', () => {
    const links = addLinks(FEED);
    expect(links.apple).toBe(FEED.webcal);
    expect(new URL(links.google).searchParams.get('cid')).toBe(FEED.webcal);
    expect(new URL(links.outlook).searchParams.get('url')).toBe(FEED.url);
    expect(new URL(links.outlook).searchParams.get('name')).toBe('Huishouden');
  });

  test('calls carry the ID token; the Worker’s error code comes back; no service, no call', async () => {
    const user = { getIdToken: async () => 'id-token', refreshToken: 'rt' } as never;
    const seen: { url: string; auth: string | null }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      seen.push({ url, auth: new Headers(init?.headers).get('Authorization') });
      return new Response(JSON.stringify({ error: 'not-member' }), { status: 403 });
    }) as typeof fetch;
    const refused = await calendarCall(user, '/api/status?household=h1', undefined, fake, 'https://calendar.example').catch((e) => e);
    expect(refused).toBeInstanceOf(CalendarCallError);
    expect(refused.code).toBe('not-member');
    expect(seen).toEqual([{ url: 'https://calendar.example/api/status?household=h1', auth: 'Bearer id-token' }]);
    expect((await calendarCall(user, '/api/status', undefined, fake, '').catch((e) => e)).code).toBe('not-configured');
  });

  test('Firestore’s daily quota used up comes back as its own code, not as unreachable', async () => {
    const user = { getIdToken: async () => 'id-token', refreshToken: 'rt' } as never;
    const fake = (async () => new Response(JSON.stringify({ error: 'firestore-quota' }), { status: 503 })) as unknown as typeof fetch;
    const e = await calendarCall(user, '/api/status?household=h1', undefined, fake, 'https://calendar.example').catch((x) => x);
    expect(e).toBeInstanceOf(CalendarCallError);
    expect(e.code).toBe('firestore-quota');
  });
});

describe('changes from Google Calendar', () => {
  const stored = {
    email: 'alice@example.com', source: 'google', app: 'home', ref: 'event:bins', title: 'Garbage pickup', change: 'moved', from: 'Thu, Oct 2, 7:00 AM', to: 'Fri, Oct 3, 8:00 AM', at: 5,
    undo: [
      { col: 'homeEvents', id: 'bins', data: { title: 'Garbage pickup' } },
      { col: 'agenda', id: 'home_event_bins_1', data: null },
      'junk',
    ],
  };

  test('read defensively', () => {
    const c = toCalendarChange('c1', stored);
    expect(c.undo).toHaveLength(2);
    expect(c.change).toBe('moved');
    expect(toCalendarChange('c2', { change: 'paid' }).change).toBe('moved');
  });

  test('Undo writes only the app’s own collections and the agenda', () => {
    expect(undoAllowed(toCalendarChange('c1', stored))).toBe(true);
    expect(undoAllowed(toCalendarChange('c3', { ...stored, undo: [{ col: 'bills', id: 'b1', data: { paid: true } }] }))).toBe(false);
    expect(undoAllowed(toCalendarChange('c4', { ...stored, undo: [] }))).toBe(false);
    expect(undoAllowed(toCalendarChange('c5', { ...stored, undo: [{ col: 'homeEvents', id: 'a/b', data: {} }] }))).toBe(false);
  });
});
