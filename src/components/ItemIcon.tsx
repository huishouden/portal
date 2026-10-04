import { agendaWords, type AgendaItem } from '@huishouden/pwa-kit/agenda';
import { AlarmClock, CalendarClock, CalendarDays, Cake, CheckSquare, Pill, Receipt, RefreshCw, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { HouseholdApp } from '../apps';
import { AppIcon } from './AppIcon';
import { t } from '../i18n';

/** What kind of thing an agenda item is, shown as its icon so a row reads at a glance ("a meal", "a bill"). */
const KIND_ICONS: Record<AgendaItem['kind'], LucideIcon> = {
  appointment: CalendarClock,
  due: AlarmClock,
  renewal: RefreshCw,
  bill: Receipt,
  birthday: Cake,
  medicine: Pill,
  feeding: UtensilsCrossed,
  task: CheckSquare,
  other: CalendarDays,
};

const KIND_KEYS = {
  appointment: 'kind.appointment',
  due: 'kind.due',
  renewal: 'kind.renewal',
  bill: 'kind.bill',
  birthday: 'kind.birthday',
  medicine: 'kind.medicine',
  feeding: 'kind.feeding',
  task: 'kind.task',
  other: 'kind.other',
} as const satisfies Record<AgendaItem['kind'], string>;

/** What kind of thing an item is, in words for screen readers: "Appointment", "Bill". */
export const kindWord = (kind: AgendaItem['kind']): string => t(KIND_KEYS[kind] ?? KIND_KEYS.other);

/** The item's kind as the main icon, with its app's logo as a small badge in the corner. */
export function ItemIcon({ item, app, size }: { item: AgendaItem; app?: HouseholdApp; size: number }) {
  const Icon = KIND_ICONS[item.kind] ?? CalendarDays;
  const badge = Math.round(size * 0.45);
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      {/* With a badge, the kind icon sits toward the top left so the badge doesn't cover it. */}
      <span
        className="flex h-full w-full items-center justify-center rounded-xl bg-tint text-link"
        style={app ? { paddingRight: Math.round(size * 0.16), paddingBottom: Math.round(size * 0.16) } : undefined}
      >
        <Icon size={Math.round(size * 0.55)} strokeWidth={2} />
      </span>
      {app && (
        <span className="absolute -right-1 -bottom-1 rounded-md ring-2 ring-surface">
          <AppIcon app={app} size={badge} />
        </span>
      )}
    </span>
  );
}

/** "Milo · dry food, 1 cup": who and detail, leaving out `who` when the title already names them. */
export function itemMeta(item: Pick<AgendaItem, 'title' | 'who' | 'detail'>): string {
  const who = item.who && !item.title.toLowerCase().includes(item.who.toLowerCase()) ? item.who : undefined;
  return [who, item.detail].filter(Boolean).join(' · ');
}

/** The item with its title and detail in the reader's language, when the app that wrote it gave them (`agendaWords`). */
export function inMyLanguage<T extends AgendaItem>(item: T): T {
  const { title, detail } = agendaWords(item);
  return { ...item, title, detail };
}
