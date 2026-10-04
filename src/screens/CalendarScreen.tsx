import { useState } from 'react';
import { agendaDays, agendaStatus, agendaTime, type AgendaItem } from '@huishouden/pwa-kit/agenda';
import { dueText, toYmd } from '@huishouden/pwa-kit/time';
import { Chip, cardClass, overline } from '@huishouden/pwa-kit/react/ui';
import { suiteLink, type HouseholdApp } from '../apps';
import { ItemIcon, inMyLanguage, itemMeta, kindWord } from '../components/ItemIcon';
import { t, useT } from '../i18n';

interface Props {
  agenda: AgendaItem[] | undefined;
  /** Every app in the household's order. */
  apps: HouseholdApp[];
  now: number;
}

/** Every app's dated things by day, from today on, with overdue ones first; each opens its app. */
export function CalendarScreen({ agenda, apps, now }: Props) {
  const t = useT();
  const [only, setOnly] = useState<string | null>(null);
  const today = toYmd(now);
  const byRepo = new Map(apps.map((a) => [a.repo, a]));
  const items = (agenda ?? []).map(inMyLanguage);
  const withItems = apps.filter((a) => items.some((i) => i.app === a.repo));
  const shown = only ? items.filter((i) => i.app === only) : items;
  const overdue = shown.filter((i) => agendaStatus(i, now) === 'overdue');
  const days = agendaDays(
    shown.filter((i) => agendaStatus(i, now) !== 'overdue'),
    now,
    { from: today },
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-ink">{t('calendar.title')}</h2>
      {withItems.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('calendar.showFrom')}>
          <Chip active={only === null} onClick={() => setOnly(null)}>
            {t('filter.allApps')}
          </Chip>
          {withItems.map((a) => (
            <Chip key={a.repo} active={only === a.repo} onClick={() => setOnly(a.repo)}>
              {a.name}
            </Chip>
          ))}
        </div>
      )}
      {agenda === undefined && <p className="text-lg text-muted">{t('calendar.loading')}</p>}
      {agenda !== undefined && overdue.length === 0 && days.length === 0 && (
        <p className={`${cardClass} p-6 text-lg text-muted`}>
          {t('calendar.empty')}
        </p>
      )}
      {overdue.length > 0 && (
        <Day label={t('calendar.overdue')} attention>
          {overdue.map((i) => (
            <Row key={i.id} item={i} app={byRepo.get(i.app)} when={i.allDay || toYmd(i.start) < today ? dueText(toYmd(i.start), today) : agendaTime(i)} attention />
          ))}
        </Day>
      )}
      {days.map((d) => (
        <Day key={d.day} label={d.label}>
          {d.items.map((i) => (
            <Row key={i.id} item={i} app={byRepo.get(i.app)} when={agendaTime(i)} done={agendaStatus(i, now) === 'done'} />
          ))}
        </Day>
      ))}
    </div>
  );
}

function Day({ label, attention, children }: { label: string; attention?: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={label}>
      <h3 className={`mb-2 ${overline} ${attention ? 'text-attention' : ''}`}>{label}</h3>
      <ul className={`${cardClass} divide-y divide-line`}>{children}</ul>
    </section>
  );
}

function Row({ item, app, when, attention, done }: { item: AgendaItem; app?: HouseholdApp; when: string; attention?: boolean; done?: boolean }) {
  const meta = itemMeta(item);
  return (
    <li>
      <a href={suiteLink(item.url)} className="flex min-h-14 items-center gap-4 px-5 py-3 hover:bg-tint">
        <span className={`w-20 shrink-0 text-sm tabular-nums sm:w-44 sm:text-base ${attention ? 'font-medium text-attention' : 'text-muted'}`}>{when}</span>
        <ItemIcon item={item} app={app} size={28} />
        <span className="min-w-0 flex-1">
          <span data-hh-data className={`block font-medium [overflow-wrap:break-word] ${done ? 'text-muted line-through' : 'text-ink'}`}>{item.title}</span>
          {meta && <span data-hh-data className="block text-sm text-muted [overflow-wrap:break-word]">{meta}</span>}
        </span>
        <span className="sr-only">
          {done ? t('calendar.kindDone', { kind: kindWord(item.kind) }) : t('calendar.kind', { kind: kindWord(item.kind) })}
        </span>
        {app && <span className="sr-only shrink-0 text-sm text-muted sm:not-sr-only">{app.name}</span>}
      </a>
    </li>
  );
}
