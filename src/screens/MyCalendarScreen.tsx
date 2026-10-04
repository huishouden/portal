import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { CalendarCheck, CalendarPlus, RefreshCw, Undo2 } from 'lucide-react';
import { Checkbox, Dialog, ErrorNotice, cardClass, deleteButton, ghostButton, linkClass, overline, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { googleAuthCode } from '@huishouden/pwa-kit/google-token';
import { popupBlocked, popupCancelled } from '@huishouden/pwa-kit/feedback';
import { formatAgo } from '@huishouden/pwa-kit/time';
import { MONEY_APPS, can, type Role } from '@huishouden/pwa-kit/roles';
import { DEFAULT_CALENDAR_SETTINGS, type CalendarSettings } from '@huishouden/pwa-kit/calendar-export';
import type { HouseholdApp } from '../apps';
import {
  CALENDAR_SCOPE, CALENDAR_URL, CalendarCallError, addLinks, calendarApi, forgetChange, saveCalendarSettings, undoAllowed, undoChange, watchCalendarChanges, watchCalendarSettings,
  type CalendarChange, type CalendarStatus,
} from '../myCalendar';
import { CopyField } from '../components/CopyField';
import { auth, db } from '../firebase';
import { useT } from '../i18n';

interface Props {
  /** undefined while sign-in restores; null signed out. */
  user: User | null | undefined;
  householdId?: string;
  me?: string;
  role: Role | null;
  /** Every app in the household's order. */
  apps: HouseholdApp[];
  notify: (message: string, undo?: () => void) => void;
  fail: (message: string) => void;
}

/** Apps that put things on the agenda (and so can be left out of a calendar). */
const DATED = ['home', 'baby', 'pet', 'car', 'health', 'tasks', 'bills'];

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * "In your own calendar" (Settings > Calendar): the household's appointments, regular events and
 * things to do in the calendar the person already uses. A private link any calendar app subscribes
 * to; a "Huishouden" calendar in their Google account that stays in step both ways; what either
 * shows; and the changes made in Google that came back, with Undo. Linked from every app's account
 * menu and from the Calendar tab.
 */
export function MyCalendarScreen({ user, householdId, me, role, apps, notify, fail }: Props) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const title = t('myCalendar.title');
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [changes, setChanges] = useState<CalendarChange[] | null>(null);
  const [confirm, setConfirm] = useState<'rotate' | 'revoke' | 'disconnect' | null>(null);
  const [deleteCalendar, setDeleteCalendar] = useState(true);

  useEffect(() => {
    const before = document.title;
    document.title = title;
    heading.current?.focus();
    return () => {
      document.title = before;
    };
  }, [title]);

  const load = useCallback(async () => {
    if (!user || !householdId || !CALENDAR_URL) return;
    setLoadError(null);
    try {
      setStatus(await calendarApi.status(user, householdId));
    } catch (e) {
      setLoadError(e instanceof CalendarCallError ? e.code : 'failed');
    }
  }, [user, householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!householdId || !me) return;
    const a = watchCalendarSettings(db, householdId, me, setSettings);
    const b = watchCalendarChanges(db, householdId, me, setChanges);
    return () => {
      a();
      b();
    };
  }, [householdId, me]);

  const errorText = (e: unknown) => {
    if (popupCancelled(e)) return t('myCalendar.googleCancelled');
    if (popupBlocked(e)) return t('myCalendar.popupBlocked');
    const code = e instanceof CalendarCallError ? e.code : '';
    if (code === 'network') return t('myCalendar.offline');
    if (code === 'firestore-quota') return t('myCalendar.dailyLimit');
    if (code === 'google-denied') return t('myCalendar.googleDenied');
    if (code === 'google-config') return t('myCalendar.googleUnavailable');
    return t('myCalendar.failed');
  };

  const run = async (what: string, action: () => Promise<CalendarStatus>, done?: string) => {
    setBusy(what);
    try {
      setStatus(await action());
      if (done) notify(done);
    } catch (e) {
      fail(errorText(e));
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const connectGoogle = async () => {
    if (!user || !householdId) return;
    setBusy('connect');
    try {
      const { code } = await googleAuthCode(auth, [CALENDAR_SCOPE], { deniedMessage: t('myCalendar.googleDenied') });
      setStatus(await calendarApi.connectGoogle(user, householdId, code));
      notify(t('myCalendar.connected'));
    } catch (e) {
      fail(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const save = (next: CalendarSettings) => {
    if (!householdId || !me) return;
    const previous = settings ?? DEFAULT_CALENDAR_SETTINGS;
    setSettings(next);
    saveCalendarSettings(db, householdId, me, next).catch(() => {
      setSettings(previous);
      fail(t('myCalendar.saveFailed'));
    });
  };

  const undo = async (c: CalendarChange) => {
    if (!householdId) return;
    try {
      await undoChange(db, householdId, c);
      notify(t('myCalendar.undone', { title: c.title }));
    } catch {
      fail(t('myCalendar.undoFailed'));
    }
  };

  const staff = can(role, 'see-money');
  const shown = settings ?? DEFAULT_CALENDAR_SETTINGS;
  const appChoices = apps.filter((a) => DATED.includes(a.repo) && (staff || !MONEY_APPS.includes(a.repo)));
  const ready = !!user && !!householdId;
  const links = status?.feed ? addLinks(status.feed) : null;
  const google = status?.google;

  return (
    <article className={`${cardClass} mx-auto max-w-[720px] space-y-8 p-6 text-base leading-relaxed text-ink sm:p-8`}>
      <header className="space-y-2">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold text-ink outline-none">
          {title}
        </h1>
        <p>{t('myCalendar.intro')}</p>
        <p className="text-muted">{t('myCalendar.privacy')}</p>
      </header>

      {user === null && <p className="text-muted">{t('myCalendar.signIn')}</p>}
      {user && !householdId && <p className="text-muted">{t('myCalendar.noHousehold')}</p>}
      {ready && !CALENDAR_URL && <p className="text-muted">{t('myCalendar.notAvailable')}</p>}
      {ready && CALENDAR_URL && loadError && <ErrorNotice message={loadError === 'firestore-quota' ? t('myCalendar.dailyLimit') : t('myCalendar.loadFailed')} onRetry={() => void load()} />}
      {ready && status?.signedOut && <p role="status" className="rounded-xl bg-attention-tint px-3 py-2 text-attention">{t('myCalendar.signedOut')}</p>}

      {ready && CALENDAR_URL && status && (
        <>
          <Section title={t('myCalendar.googleTitle')} icon={<CalendarCheck className="size-6 text-primary" aria-hidden />}>
            <p>{t('myCalendar.googleIntro')}</p>
            {!status.googleAvailable ? (
              <p className="text-muted">{t('myCalendar.googleUnavailable')}</p>
            ) : !google ? (
              <>
                {status.lastError === 'calendar-deleted' && <p className="text-muted">{t('myCalendar.calendarDeleted')}</p>}
                <button type="button" className={primaryButton} disabled={busy === 'connect'} onClick={() => void connectGoogle()}>
                  <CalendarPlus className="size-5" aria-hidden />
                  {busy === 'connect' ? t('myCalendar.connecting') : t('myCalendar.connect')}
                </button>
                <p className="text-sm text-muted">{t('myCalendar.googleScope')}</p>
              </>
            ) : (
              <div className="space-y-3 rounded-xl border border-line p-4">
                {/* i18n-ignore: the person's own Google account address */}
                <p className="font-semibold text-ink" data-hh-data>
                  {google.account || t('myCalendar.googleAccount')}
                </p>
                <p className="text-sm text-muted" aria-live="polite">
                  {google.lastOk ? t('myCalendar.lastSync', { ago: formatAgo(google.lastOk, Date.now()) }) : t('myCalendar.firstSync')}
                  {google.counts?.events !== undefined ? ` · ${t('myCalendar.eventCount', { n: google.counts.events })}` : ''}
                </p>
                {google.error && <p role="alert" className="text-error">{t(syncErrorKey(google.error))}</p>}
                {google.notice?.startsWith('refused:') && (
                  <p role="status" className="text-attention">
                    {t('myCalendar.refused', { n: Number(google.notice.slice(8)) || 1 })}{' '}
                    <button type="button" className={linkClass} onClick={() => void run('notice', () => calendarApi.clearNotice(user!, householdId!))}>
                      {t('myCalendar.ok')}
                    </button>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={secondaryButton} disabled={busy === 'sync'} onClick={() => void run('sync', () => calendarApi.syncNow(user!, householdId!), t('myCalendar.synced'))}>
                    <RefreshCw className="size-5" aria-hidden />
                    {busy === 'sync' ? t('myCalendar.syncing') : t('myCalendar.syncNow')}
                  </button>
                  <button type="button" className={ghostButton} onClick={() => setConfirm('disconnect')}>
                    {t('myCalendar.disconnect')}
                  </button>
                </div>
                <p className="text-sm text-muted">{t('myCalendar.twoWay')}</p>
              </div>
            )}
          </Section>

          <Section title={t('myCalendar.feedTitle')}>
            <p>{t('myCalendar.feedIntro')}</p>
            {!status.feed ? (
              <button type="button" className={primaryButton} disabled={busy === 'feed'} onClick={() => void run('feed', () => calendarApi.makeFeed(user!, householdId!))}>
                {busy === 'feed' ? t('myCalendar.making') : t('myCalendar.makeFeed')}
              </button>
            ) : (
              <div className="space-y-4">
                <CopyField value={status.feed.url} label={t('myCalendar.feedLabel')} />
                <p className="text-sm text-muted">{t('myCalendar.feedSecret')}</p>
                <div className="space-y-3">
                  <h3 className={overline}>{t('myCalendar.addTo')}</h3>
                  <div className="flex flex-wrap gap-2">
                    <a className={secondaryButton} href={links!.apple}>
                      {t('myCalendar.apple')}
                    </a>
                    <a className={secondaryButton} href={links!.google} target="_blank" rel="noopener noreferrer">
                      {t('myCalendar.googleFeed')}
                    </a>
                    <a className={secondaryButton} href={links!.outlook} target="_blank" rel="noopener noreferrer">
                      {t('myCalendar.outlook')}
                    </a>
                  </div>
                  <ul className="list-disc space-y-1 pl-6 text-sm text-muted">
                    <li>{t('myCalendar.appleHow')}</li>
                    <li>{t('myCalendar.googleHow')}</li>
                    <li>{t('myCalendar.outlookHow')}</li>
                    <li>{t('myCalendar.otherHow')}</li>
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={ghostButton} onClick={() => setConfirm('rotate')}>
                    {t('myCalendar.rotate')}
                  </button>
                  <button type="button" className={ghostButton} onClick={() => setConfirm('revoke')}>
                    {t('myCalendar.revoke')}
                  </button>
                </div>
              </div>
            )}
          </Section>
        </>
      )}

      {ready && (
        <Section title={t('myCalendar.showsTitle')}>
          <p className="text-muted">{t('myCalendar.showsIntro')}</p>
          <fieldset className="space-y-1">
            <legend className={overline}>{t('myCalendar.apps')}</legend>
            {appChoices.map((a) => (
              <Checkbox
                key={a.repo}
                checked={!shown.hiddenApps.includes(a.repo)}
                onChange={(on) => save({ ...shown, hiddenApps: on ? shown.hiddenApps.filter((x) => x !== a.repo) : [...shown.hiddenApps, a.repo] })}
              >
                {a.name}
              </Checkbox>
            ))}
          </fieldset>
          <fieldset className="space-y-1">
            <legend className={overline}>{t('myCalendar.also')}</legend>
            <Checkbox checked={shown.todos} onChange={(todos) => save({ ...shown, todos })}>
              {t('myCalendar.todos')}
            </Checkbox>
            {staff && (
              <Checkbox checked={shown.bills} onChange={(bills) => save({ ...shown, bills })}>
                {t('myCalendar.bills')}
              </Checkbox>
            )}
            <Checkbox checked={shown.done} onChange={(done) => save({ ...shown, done })}>
              {t('myCalendar.done')}
            </Checkbox>
            <Checkbox checked={shown.healthDetail} onChange={(healthDetail) => save({ ...shown, healthDetail })}>
              {t('myCalendar.healthDetail')}
            </Checkbox>
            <p className="pl-9 text-sm text-muted">{t('myCalendar.healthDetailHint')}</p>
          </fieldset>
        </Section>
      )}

      {ready && changes && changes.length > 0 && (
        <Section title={t('myCalendar.historyTitle')}>
          <p className="text-muted">{t('myCalendar.historyIntro')}</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {changes.slice(0, 20).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-ink" data-hh-data>
                    {/* i18n-dynamic: myCalendar.change. */}
                    {t(`myCalendar.change.${c.change}`, { title: c.title, from: c.from ?? '', to: c.to ?? '' })}
                  </p>
                  <p className="text-sm text-muted">{formatAgo(c.at, Date.now())}</p>
                </div>
                {undoAllowed(c) && (
                  <button type="button" className={secondaryButton} onClick={() => void undo(c)}>
                    <Undo2 className="size-5" aria-hidden />
                    {t('myCalendar.undo')}
                  </button>
                )}
                <button type="button" className={ghostButton} aria-label={t('myCalendar.dismissLabel', { title: c.title })} onClick={() => void forgetChange(db, householdId!, c).catch(() => fail(t('myCalendar.failed')))}>
                  {t('myCalendar.dismiss')}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="text-sm text-muted">
        {t('myCalendar.source')}{' '}
        <a className={linkClass} href="https://github.com/huishouden/calendar">
          {t('myCalendar.sourceLink')}
        </a>
      </p>

      {confirm === 'rotate' && (
        <Dialog
          title={t('myCalendar.rotateTitle')}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className={ghostButton} onClick={() => setConfirm(null)}>
                {t('myCalendar.cancel')}
              </button>
              <button type="button" className={primaryButton} disabled={busy === 'rotate'} onClick={() => void run('rotate', () => calendarApi.rotateFeed(user!, householdId!), t('myCalendar.rotated'))}>
                {t('myCalendar.rotate')}
              </button>
            </>
          }
        >
          <p>{t('myCalendar.rotateBody')}</p>
        </Dialog>
      )}
      {confirm === 'revoke' && (
        <Dialog
          title={t('myCalendar.revokeTitle')}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className={ghostButton} onClick={() => setConfirm(null)}>
                {t('myCalendar.cancel')}
              </button>
              <button type="button" className={deleteButton} disabled={busy === 'revoke'} onClick={() => void run('revoke', () => calendarApi.revokeFeed(user!, householdId!), t('myCalendar.revoked'))}>
                {t('myCalendar.revoke')}
              </button>
            </>
          }
        >
          <p>{t('myCalendar.revokeBody')}</p>
        </Dialog>
      )}
      {confirm === 'disconnect' && (
        <Dialog
          title={t('myCalendar.disconnectTitle')}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className={ghostButton} onClick={() => setConfirm(null)}>
                {t('myCalendar.cancel')}
              </button>
              <button
                type="button"
                className={deleteButton}
                disabled={busy === 'disconnect'}
                onClick={() => void run('disconnect', () => calendarApi.disconnectGoogle(user!, householdId!, deleteCalendar), t(deleteCalendar ? 'myCalendar.disconnectedDeleted' : 'myCalendar.disconnected'))}
              >
                {t('myCalendar.disconnect')}
              </button>
            </>
          }
        >
          <p>{t('myCalendar.disconnectBody')}</p>
          <Checkbox checked={deleteCalendar} onChange={setDeleteCalendar}>
            {t('myCalendar.deleteCalendar')}
          </Checkbox>
        </Dialog>
      )}
    </article>
  );
}

/** The sentence for a sync error the Worker recorded. */
function syncErrorKey(code: string): 'myCalendar.errorRevoked' | 'myCalendar.errorSignedOut' | 'myCalendar.errorMember' | 'myCalendar.errorGoogle' {
  if (code === 'google-revoked') return 'myCalendar.errorRevoked';
  if (code === 'signed-out') return 'myCalendar.errorSignedOut';
  if (code === 'not-member') return 'myCalendar.errorMember';
  return 'myCalendar.errorGoogle';
}
