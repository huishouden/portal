import { describe, expect, test } from 'bun:test';
import { addLinks, calendarApi, CalendarCallError, toCalendarChange, undoAllowed } from './myCalendar';

const FEED = { url: 'https://huishouden-calendar.example.workers.dev/feed/abcdefghijklmnopqrstuvwx.ics', webcal: 'webcal://huishouden-calendar.example.workers.dev/feed/abcdefghijklmnopqrstuvwx.ics' };

describe('the calendar link', () => {
  test('each calendar app gets the address it takes', () => {
    const links = addLinks(FEED);
    expect(links.apple).toBe(FEED.webcal);
    expect(new URL(links.google).searchParams.get('cid')).toBe(FEED.webcal);
    expect(new URL(links.outlook).searchParams.get('url')).toBe(FEED.url);
    expect(new URL(links.outlook).searchParams.get('name')).toBe('Huishouden');
  });

  test('without a calendar service in this build, calls say so', async () => {
    const user = { getIdToken: async () => 'id', refreshToken: 'rt' } as never;
    const error = await calendarApi.status(user, 'h1').catch((e) => e);
    expect(error).toBeInstanceOf(CalendarCallError);
    expect(error.code).toBe('not-configured');
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
