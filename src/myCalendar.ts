import { collection, doc, onSnapshot, query, where, type Firestore, type Unsubscribe } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { commitOps, setDoc } from '@huishouden/pwa-kit/firestore';
import { getLang } from '@huishouden/pwa-kit/i18n';
import { AGENDA_EDIT_COLLECTIONS, PERSONAL_AGENDA } from '@huishouden/pwa-kit/agenda';
import { calendarSettingsDoc, toCalendarSettings, CALENDAR_SETTINGS, type CalendarSettings } from '@huishouden/pwa-kit/calendar-export';
import type { Op } from '@huishouden/pwa-kit/store';

/**
 * The household in the person's own calendar (huishouden/calendar): the Worker's address, its calls
 * (the feed's link, Google Calendar's connection), the person's settings
 * (`calendarSettings/{email}`) and the changes made in Google Calendar that came back
 * (`calendarChanges`, only theirs), with Undo.
 */

/** The calendar Worker for this build (production or staging), from the VITE_CALENDAR_URL repo variable. */
export const CALENDAR_URL = (import.meta.env.VITE_CALENDAR_URL ?? '').replace(/\/$/, '');

/** Google's narrow scope: calendars this app made, and nothing else in the account. */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

export interface CalendarStatus {
  feed: { url: string; webcal: string; createdAt: number } | null;
  signedOut: boolean;
  googleAvailable: boolean;
  google: {
    account: string;
    connectedAt: number;
    lastSync: number | null;
    lastOk: number | null;
    error: string | null;
    notice: string | null;
    counts: Record<string, number> | null;
  } | null;
  lastError: string | null;
}

/** Why a call failed, as the Worker says it ("not-member", "google-denied"); "network" when it can't be reached. */
export class CalendarCallError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

/** The person, their language and zone: what the Worker acts with. The refresh token never goes anywhere else. */
const identity = (user: User) => ({ refreshToken: user.refreshToken, lang: getLang(), ...(timeZone() ? { timeZone: timeZone() } : {}) });

async function call(user: User, path: string, body?: Record<string, unknown>, fetchImpl: typeof fetch = fetch, base = CALENDAR_URL): Promise<CalendarStatus> {
  if (!base) throw new CalendarCallError('not-configured');
  const idToken = await user.getIdToken();
  let res: Response;
  try {
    res = await fetchImpl(`${base}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${idToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new CalendarCallError('network');
  }
  const answer = (await res.json().catch(() => ({}))) as CalendarStatus & { error?: string };
  if (!res.ok) throw new CalendarCallError(answer.error ?? `http-${res.status}`);
  return answer;
}

export const calendarApi = {
  status: (user: User, household: string, f?: typeof fetch) => call(user, `/api/status?household=${encodeURIComponent(household)}`, undefined, f),
  makeFeed: (user: User, household: string, f?: typeof fetch) => call(user, '/api/feed', { household, ...identity(user) }, f),
  rotateFeed: (user: User, household: string, f?: typeof fetch) => call(user, '/api/feed/rotate', { household, ...identity(user) }, f),
  revokeFeed: (user: User, household: string, f?: typeof fetch) => call(user, '/api/feed/revoke', { household }, f),
  connectGoogle: (user: User, household: string, code: string, f?: typeof fetch) => call(user, '/api/google/connect', { household, code, ...identity(user) }, f),
  syncNow: (user: User, household: string, f?: typeof fetch) => call(user, '/api/google/sync', { household }, f),
  disconnectGoogle: (user: User, household: string, deleteCalendar: boolean, f?: typeof fetch) => call(user, '/api/google/disconnect', { household, deleteCalendar }, f),
  clearNotice: (user: User, household: string, f?: typeof fetch) => call(user, '/api/notice/clear', { household }, f),
};

/** Links that add the feed to each calendar app. Google's takes the webcal address, Outlook's the https one. */
export function addLinks(feed: { url: string; webcal: string }, name = 'Huishouden') {
  return {
    apple: feed.webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feed.webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feed.url)}&name=${encodeURIComponent(name)}`,
  };
}

// ---- Settings ----

export function watchCalendarSettings(db: Firestore, householdId: string, me: string, onChange: (s: CalendarSettings) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'households', householdId, CALENDAR_SETTINGS, me),
    (snap) => onChange(toCalendarSettings(snap.data())),
    () => onChange(toCalendarSettings(undefined)),
  );
}

export function saveCalendarSettings(db: Firestore, householdId: string, me: string, settings: CalendarSettings): Promise<void> {
  return setDoc(doc(db, 'households', householdId, CALENDAR_SETTINGS, me), calendarSettingsDoc(settings, me));
}

// ---- Changes from Google Calendar ----

export type ChangeKind = 'moved' | 'retimed' | 'renamed' | 'notes' | 'skipped' | 'cancelled';

export interface CalendarChange {
  id: string;
  app: string;
  ref: string;
  title: string;
  change: ChangeKind;
  from?: string;
  to?: string;
  undo: Op[];
  at: number;
}

const KINDS: readonly ChangeKind[] = ['moved', 'retimed', 'renamed', 'notes', 'skipped', 'cancelled'];

export function toCalendarChange(id: string, d: Record<string, unknown>): CalendarChange {
  const undo = Array.isArray(d.undo)
    ? d.undo.flatMap((o): Op[] => {
        if (!o || typeof o !== 'object') return [];
        const { col, id: docId, data, merge } = o as Record<string, unknown>;
        if (typeof col !== 'string' || typeof docId !== 'string') return [];
        if (data !== null && (typeof data !== 'object' || Array.isArray(data))) return [];
        return [{ col, id: docId, data: data as object | null, ...(merge === true ? { merge: true } : {}) }];
      })
    : [];
  return {
    id,
    app: typeof d.app === 'string' ? d.app : '',
    ref: typeof d.ref === 'string' ? d.ref : '',
    title: typeof d.title === 'string' ? d.title : '',
    change: KINDS.includes(d.change as ChangeKind) ? (d.change as ChangeKind) : 'moved',
    ...(typeof d.from === 'string' ? { from: d.from } : {}),
    ...(typeof d.to === 'string' ? { to: d.to } : {}),
    undo,
    at: typeof d.at === 'number' ? d.at : 0,
  };
}

/** The person's own changes from Google Calendar, newest first. */
export function watchCalendarChanges(db: Firestore, householdId: string, me: string, onChange: (list: CalendarChange[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'households', householdId, 'calendarChanges'), where('email', '==', me)),
    (snap) => onChange(snap.docs.map((d) => toCalendarChange(d.id, d.data())).sort((a, b) => b.at - a.at)),
    () => onChange([]),
  );
}

/** Whether an Undo writes only where the change could have: the app's own collections and the agenda. */
export function undoAllowed(change: CalendarChange): boolean {
  const allowed = [...(AGENDA_EDIT_COLLECTIONS[change.app] ?? []), 'agenda', PERSONAL_AGENDA];
  return change.undo.length > 0 && change.undo.every((op) => allowed.includes(op.col) && /^[^/]{1,200}$/.test(op.id));
}

/** Puts the records back as they were, as the person (the rules decide), and drops the entry. */
export async function undoChange(db: Firestore, householdId: string, change: CalendarChange): Promise<void> {
  if (!undoAllowed(change)) throw new Error('undo-refused');
  await commitOps(db, `households/${householdId}`, [...change.undo, { col: 'calendarChanges', id: change.id, data: null }]);
}

/** Dismisses an entry without undoing it. */
export function forgetChange(db: Firestore, householdId: string, change: CalendarChange): Promise<void> {
  return commitOps(db, `households/${householdId}`, [{ col: 'calendarChanges', id: change.id, data: null }]);
}
