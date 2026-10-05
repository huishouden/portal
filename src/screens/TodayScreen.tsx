import { type AgendaItem, type TodayEntry, type TodayGroup } from '@huishouden/pwa-kit/agenda';
import { longDate, toYmd } from '@huishouden/pwa-kit/time';
import { DoneBadge, cardClass, overline } from '@huishouden/pwa-kit/react/ui';
import { ChevronDown } from 'lucide-react';
import { suiteLink, type HouseholdApp } from '../apps';
import { AppIcon } from '../components/AppIcon';
import { Greeting } from '../components/DutchWord';
import { ItemIcon, inMyLanguage, itemMeta, kindWord } from '../components/ItemIcon';
import { t, useT } from '../i18n';
import type { MemberProfile } from '../hub';
import { appSummaries, doneLine, todayBoard } from '../today';

interface Props {
  /** Undefined while loading (or while sign-in restores): skeleton rows hold the layout. */
  agenda: AgendaItem[] | undefined;
  /** Every app in the household's order. */
  apps: HouseholdApp[];
  now: number;
  /** The signed-in member and the household's names, for who marked things done. */
  me?: string;
  profiles?: Record<string, MemberProfile>;
}

const HEADINGS = { overdue: 'today.overdue', today: 'today.today', soon: 'today.soon' } as const satisfies Record<Exclude<TodayGroup, 'done'>, string>;

/**
 * The wall-tablet glance: what is overdue, what is on today and in the next two days across every
 * app, big enough to read across the room, each a tap away from its app; what has been done today,
 * folded away at the bottom; and one line per app.
 */
export function TodayScreen({ agenda: stored, apps, now, me = '', profiles = {} }: Props) {
  const t = useT();
  const agenda = stored?.map(inMyLanguage);
  const today = toYmd(now);
  const byRepo = new Map(apps.map((a) => [a.repo, a]));
  const { open, done } = agenda ? todayBoard(agenda, now) : { open: [], done: [] };
  const groups = (['overdue', 'today', 'soon'] as const)
    .map((g) => ({ group: g, entries: open.filter((e) => e.group === g) }))
    .filter((g) => g.entries.length > 0);
  const summaries = agenda ? appSummaries(agenda, apps, now) : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 sm:gap-x-6">
        <Greeting hour={new Date(now).getHours()} compact />
        <p className="text-base text-muted sm:text-lg">{longDate(today, today)}</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6" aria-live="polite">
          {agenda === undefined && <Skeleton />}
          {agenda !== undefined && groups.length === 0 && (
            <p className={`${cardClass} p-6 text-xl text-muted`}>{t('today.empty')}</p>
          )}
          {groups.map(({ group, entries }) => (
            <section key={group} aria-label={t(HEADINGS[group])}>
              <h2 className={`mb-2 ${overline} ${group === 'overdue' ? 'text-attention' : ''}`}>{t(HEADINGS[group])}</h2>
              <ul className={`${cardClass} divide-y divide-line`}>
                {entries.map((e) => (
                  <TodayRow key={e.item.id} entry={e} app={byRepo.get(e.item.app)} />
                ))}
              </ul>
            </section>
          ))}
          {done.length > 0 && (
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-muted hover:text-link [&::-webkit-details-marker]:hidden">
                <DoneBadge />
                <span className={overline}>{t('today.doneToday', { count: done.length })}</span>
                <ChevronDown size={18} className="transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </summary>
              <ul className={`${cardClass} mt-2 divide-y divide-line`} aria-label={t('today.doneTodayList')}>
                {done.map(({ item }) => (
                  <DoneRow key={item.id} item={item} app={byRepo.get(item.app)} line={doneLine(item, now, me, profiles)} />
                ))}
              </ul>
            </details>
          )}
        </div>
        {summaries.length > 0 && (
          <section aria-label={t('today.byApp')} className={`${cardClass} p-5`}>
            <h2 className={`mb-2 ${overline}`}>{t('today.byApp')}</h2>
            <ul className="divide-y divide-line">
              {summaries.map(({ app, overdue, week }) => (
                <li key={app.repo}>
                  <a href={app.url} className="flex min-h-14 items-center gap-3 py-2 hover:text-link">
                    <AppIcon app={app} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{app.name}</span>
                      <span className="block text-muted">
                        {overdue > 0 && <span className="font-medium text-attention">{t('today.appOverdue', { count: overdue })}</span>}
                        {overdue > 0 && week > 0 && ' · '}
                        {week > 0 && t('today.appWeek', { count: week })}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

const pulse = 'animate-pulse rounded bg-sunken motion-reduce:animate-none';

/** Rows the size of real ones while the day loads, so nothing jumps when it arrives. */
function Skeleton() {
  return (
    <section aria-busy="true" aria-label={t('common.loading')}>
      <p className="sr-only">{t('today.loading')}</p>
      <div className="mb-2 h-4 w-24 rounded bg-stone-200 dark:bg-forest-700" aria-hidden="true" />
      <ul className={`${cardClass} divide-y divide-line`} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex min-h-20 items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
            <span className={`h-11 w-11 shrink-0 ${pulse} rounded-xl`} />
            <span className="flex-1 space-y-2">
              <span className={`block h-6 w-2/3 ${pulse}`} />
              <span className={`block h-5 w-1/3 ${pulse}`} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TodayRow({ entry: { item, group, when }, app }: { entry: TodayEntry; app?: HouseholdApp }) {
  const meta = itemMeta(item);
  const tone = group === 'overdue' ? 'text-attention' : 'text-ink-soft';
  return (
    <li>
      <a href={suiteLink(item.url)} className="flex min-h-20 items-center gap-3 px-4 py-3 hover:bg-tint sm:gap-4 sm:px-5 sm:py-4">
        <ItemIcon item={item} app={app} size={44} />
        <span className="min-w-0 flex-1">
          <span data-hh-data className="block text-xl font-semibold text-ink [overflow-wrap:break-word] sm:text-2xl">{item.title}</span>
          <span className={`block text-lg font-medium tabular-nums sm:hidden ${tone}`}>{when}</span>
          {meta && <span data-hh-data className="block text-base text-muted [overflow-wrap:break-word] sm:text-lg">{meta}</span>}
        </span>
        <span className={`hidden shrink-0 text-right text-xl font-medium tabular-nums sm:block ${tone}`}>{when}</span>
        <span className="sr-only">
          {app ? t('today.rowOpenIn', { kind: kindWord(item.kind), app: app.name }) : t('today.rowOpen', { kind: kindWord(item.kind) })}
        </span>
      </a>
    </li>
  );
}

function DoneRow({ item, app, line }: { item: AgendaItem; app?: HouseholdApp; line: string }) {
  const meta = [itemMeta(item), line].filter(Boolean).join(' · ');
  return (
    <li>
      <a href={suiteLink(item.url)} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-tint sm:gap-4 sm:px-5">
        <DoneBadge />
        <span className="min-w-0 flex-1">
          <span data-hh-data className="block text-lg font-semibold text-muted [overflow-wrap:break-word]">{item.title}</span>
          <span className="block text-base text-muted [overflow-wrap:break-word]">{meta}</span>
        </span>
        <span className="sr-only">
          {app ? t('today.doneRowOpenIn', { kind: kindWord(item.kind), app: app.name }) : t('today.doneRowOpen', { kind: kindWord(item.kind) })}
        </span>
      </a>
    </li>
  );
}
