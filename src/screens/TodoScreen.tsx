import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ExternalLink, X } from 'lucide-react';
import { addedText, canDo, olderThan, todoDueText, todoOverdue, todoWords, type TodoItem } from '@huishouden/pwa-kit/todos';
import { formatList } from '@huishouden/pwa-kit/i18n';
import { isRestricted, type Role } from '@huishouden/pwa-kit/roles';
import { RoleNote } from '@huishouden/pwa-kit/react/roles';
import { Chip, Dialog, cardClass, ghostButton, primaryButton, secondaryButton, selectClass } from '@huishouden/pwa-kit/react/ui';
import { suiteLink, type HouseholdApp } from '../apps';
import { AppIcon } from '../components/AppIcon';
import type { HubActions } from '../hub';
import { t, useT } from '../i18n';
import { actedLine, appsWithTodos, bulkLine, cancellable, DEFAULT_VIEW, OLD_DAYS, shownTodos, summaryLine, type TodoView } from '../todo';

interface Props {
  /** Undefined while loading: skeleton rows hold the layout. */
  todos: TodoItem[] | undefined;
  /** Every app in the household's order. */
  apps: HouseholdApp[];
  now: number;
  me?: string;
  role: Role | null;
  actions: HubActions;
  notify: (message: string, undo?: () => void) => void;
  fail: (message: string) => void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Every app's open things to do in one list, newest first, so the household can see what is
 * waiting anywhere and clear out what nobody is going to do: Done or Cancel on each (in its app's
 * own terms: Pause, Skip, Mark paid), Open in its app, and a bulk Cancel for old ones. What a role
 * can't do is left out; the source app's rules decide every write.
 */
export function TodoScreen({ todos, apps, now, me, role, actions, notify, fail }: Props) {
  const t = useT();
  const [view, setView] = useState<TodoView>(DEFAULT_VIEW);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<TodoItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const byRepo = useMemo(() => new Map(apps.map((a) => [a.repo, a])), [apps]);
  const order = useMemo(() => apps.map((a) => a.repo), [apps]);
  const items = todos ?? [];
  const shown = shownTodos(items, view, order, now);
  const withItems = appsWithTodos(items.filter((i) => i.status === 'open'), order);
  const oldCount = items.filter((i) => olderThan(i, now, OLD_DAYS)).length;
  const canCancelShown = cancellable(shown, role, me);
  const selectedItems = canCancelShown.filter((i) => selected.has(i.id));
  const someoneElses = isRestricted(role) && items.some((i) => i.status === 'open' && i.cancel && !canDo(i, 'cancel', role, me));
  const appName = (repo: string) => byRepo.get(repo)?.name ?? repo;

  const run = async (item: TodoItem, which: 'done' | 'cancel') => {
    const action = item[which]!;
    const words = todoWords(item);
    try {
      const done = await actions.runTodo(item, which);
      done.written.catch((e) => fail(message(e)));
      notify(actedLine(action.label, words.title, words[which]), () => void done.undo().catch((e) => fail(message(e))));
    } catch (e) {
      fail(message(e));
    }
  };

  const cancelAll = async (list: TodoItem[]) => {
    setBusy(true);
    const undos: (() => Promise<void>)[] = [];
    try {
      for (const item of list) {
        const done = await actions.runTodo(item, 'cancel');
        done.written.catch((e) => fail(message(e)));
        undos.push(done.undo);
      }
      setSelecting(false);
      setSelected(new Set());
      notify(bulkLine(undos.length), () => void Promise.all(undos.map((u) => u())).catch((e) => fail(message(e))));
    } catch (e) {
      fail(undos.length ? `${bulkLine(undos.length)} ${message(e)}` : message(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setSort = (sort: TodoView['sort']) => setView((v) => ({ ...v, sort }));
  const byDate = view.sort === 'newest' || view.sort === 'oldest';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-ink">{t('todo.title')}</h2>
          {todos !== undefined && (
            <p className="text-base text-muted" aria-live="polite">
              {summaryLine(items, now)}
            </p>
          )}
        </div>
        {canCancelShown.length > 0 && (
          <button
            type="button"
            className={secondaryButton}
            aria-pressed={selecting}
            onClick={() => {
              setSelecting((s) => !s);
              setSelected(new Set());
            }}
          >
            {selecting ? t('todo.doneSelecting') : t('todo.select')}
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">{t('todo.sort')}</span>
            <select className={selectClass} value={view.sort} onChange={(e) => setSort(e.target.value as TodoView['sort'])}>
              <option value="newest">{t('todo.sortNewest')}</option>
              <option value="oldest">{t('todo.sortOldest')}</option>
              <option value="due">{t('todo.sortDue')}</option>
              <option value="app">{t('todo.sortApp')}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">{t('todo.show')}</span>
            <select
              className={selectClass}
              value={view.old ? 'old' : (view.app ?? '')}
              onChange={(e) => {
                const v = e.target.value;
                setView((cur) => ({ ...cur, app: v && v !== 'old' ? v : null, old: v === 'old' }));
              }}
            >
              <option value="">{t('filter.allApps')}</option>
              {withItems.map((repo) => (
                <option key={repo} value={repo}>
                  {appName(repo)}
                </option>
              ))}
              {oldCount > 0 && <option value="old">{t('todo.olderThan', { days: OLD_DAYS, count: oldCount })}</option>}
            </select>
          </label>
        </div>
      )}
      {items.length > 0 && (
        <div className="hidden space-y-2 sm:block">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('todo.sort')}>
            <span className="mr-1 text-sm font-medium text-muted">{t('todo.sort')}</span>
            <Chip
              active={byDate}
              onClick={() => setSort(view.sort === 'newest' ? 'oldest' : 'newest')}
              label={view.sort === 'oldest' ? t('todo.dateAddedOldest') : t('todo.dateAddedNewest')}
            >
              {t('todo.dateAdded')}
              {view.sort === 'oldest' ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}
            </Chip>
            <Chip active={view.sort === 'due'} onClick={() => setSort('due')}>
              {t('todo.chipDue')}
            </Chip>
            <Chip active={view.sort === 'app'} onClick={() => setSort('app')}>
              {t('todo.sortApp')}
            </Chip>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('todo.show')}>
            {withItems.length > 1 && (
              <>
                <Chip active={view.app === null} onClick={() => setView((v) => ({ ...v, app: null }))}>
                  {t('filter.allApps')}
                </Chip>
                {withItems.map((repo) => (
                  <Chip key={repo} active={view.app === repo} onClick={() => setView((v) => ({ ...v, app: v.app === repo ? null : repo }))}>
                    {appName(repo)}
                  </Chip>
                ))}
              </>
            )}
            {oldCount > 0 && (
              <Chip active={view.old} onClick={() => setView((v) => ({ ...v, old: !v.old }))}>
                {t('todo.olderThan', { days: OLD_DAYS, count: oldCount })}
              </Chip>
            )}
          </div>
        </div>
      )}

      {todos === undefined && <Skeleton />}
      {todos !== undefined && shown.length === 0 && (
        <p className={`${cardClass} p-6 text-lg text-muted`}>
          {items.length === 0 ? t('todo.empty') : t('todo.emptyFilter')}
        </p>
      )}
      {shown.length > 0 && (
        <ul className={`${cardClass} divide-y divide-line`} aria-label={t('todo.list')}>
          {shown.map((item) => (
            <Row
              key={item.id}
              item={item}
              app={byRepo.get(item.app)}
              now={now}
              mayDone={canDo(item, 'done', role, me)}
              mayCancel={canDo(item, 'cancel', role, me)}
              selecting={selecting}
              checked={selected.has(item.id)}
              onToggle={() => toggle(item.id)}
              onDone={() => void run(item, 'done')}
              onCancel={() => setConfirm([item])}
            />
          ))}
        </ul>
      )}
      {someoneElses && <RoleNote action="edit-others" />}

      {selecting && (
        <div className="fixed inset-x-0 bottom-(--hh-bottom-nav) z-40 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2">
            <span className="text-base font-medium text-ink tabular-nums" aria-live="polite">
              {t('todo.selected', { count: selectedItems.length })}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={ghostButton}
                onClick={() => setSelected(selectedItems.length === canCancelShown.length ? new Set() : new Set(canCancelShown.map((i) => i.id)))}
              >
                {selectedItems.length === canCancelShown.length ? t('todo.selectNone') : t('todo.selectAll', { count: canCancelShown.length })}
              </button>
              <button type="button" className={primaryButton} disabled={selectedItems.length === 0 || busy} onClick={() => setConfirm(selectedItems)}>
                {selectedItems.length ? t('todo.cancelCount', { count: selectedItems.length }) : t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {selecting && <div className="h-20" aria-hidden="true" />}

      {confirm && (
        <ConfirmCancel
          items={confirm}
          appName={appName}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const list = confirm;
            setConfirm(null);
            if (list.length === 1 && !selecting) void run(list[0], 'cancel');
            else void cancelAll(list);
          }}
        />
      )}
    </div>
  );
}

function Row({
  item,
  app,
  now,
  mayDone,
  mayCancel,
  selecting,
  checked,
  onToggle,
  onDone,
  onCancel,
}: {
  item: TodoItem;
  app?: HouseholdApp;
  now: number;
  mayDone: boolean;
  mayCancel: boolean;
  selecting: boolean;
  checked: boolean;
  onToggle: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const due = todoDueText(item, now);
  const overdue = todoOverdue(item, now);
  const info = item.status === 'info';
  const appLabel = app?.name ?? item.app;
  const words = todoWords(item);
  const meta = [item.who, words.detail].filter(Boolean).join(' · ');
  return (
    <li aria-label={words.title} className={`flex gap-3 px-4 py-3 sm:items-center sm:gap-4 sm:px-5 ${checked ? 'bg-tint' : ''}`}>
      {selecting && (
        <span className="flex h-11 w-8 shrink-0 items-center justify-center">
          {mayCancel && <input type="checkbox" className="h-5 w-5 accent-forest-700 dark:accent-forest-400" checked={checked} onChange={onToggle} aria-label={t('todo.selectItem', { title: words.title })} />}
        </span>
      )}
      {app && (
        <span className="mt-1 shrink-0 sm:mt-0">
          <AppIcon app={app} size={36} />
        </span>
      )}
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p data-hh-data className="text-lg font-semibold text-ink [overflow-wrap:break-word]">{words.title}</p>
          <p className="text-sm text-muted [overflow-wrap:break-word]">
            <span className="font-medium">{appLabel}</span>
            {meta && (
              <>
                {' · '}
                <span data-hh-data>{meta}</span>
              </>
            )}
            {due && (
              <>
                {' · '}
                <span className={overdue ? 'font-medium text-attention' : ''}>{due}</span>
              </>
            )}
            {!info && ` · ${addedText(item, now)}`}
          </p>
        </div>
        {!selecting && (
          <div className="mt-2 flex flex-wrap items-center gap-1 sm:mt-0 sm:shrink-0 sm:justify-end">
            {mayDone && item.done && (
              <button type="button" className={`${secondaryButton} px-3`} data-todo-action="done" aria-label={t('todo.actionOn', { action: words.done ?? item.done.label, title: words.title })} onClick={onDone}>
                <Check size={18} aria-hidden="true" />
                {words.done ?? item.done.label}
              </button>
            )}
            {mayCancel && item.cancel && (
              <button type="button" className={ghostButton} data-todo-action="cancel" aria-label={t('todo.actionOn', { action: words.cancel ?? item.cancel.label, title: words.title })} onClick={onCancel}>
                <X size={18} aria-hidden="true" />
                {words.cancel ?? item.cancel.label}
              </button>
            )}
            <a
              href={suiteLink(item.url)}
              className={`${ghostButton} min-w-11 text-link`}
              aria-label={t('todo.openIn', { title: words.title, app: appLabel })}
            >
              <ExternalLink size={18} aria-hidden="true" />
              <span className="hidden sm:inline">{t('todo.open')}</span>
            </a>
          </div>
        )}
      </div>
    </li>
  );
}

function ConfirmCancel({ items, appName, onClose, onConfirm }: { items: TodoItem[]; appName: (repo: string) => string; onClose: () => void; onConfirm: () => void }) {
  const t = useT();
  const one = items.length === 1 ? items[0] : null;
  const words = one ? todoWords(one) : null;
  const oneLabel = words ? (words.cancel ?? one!.cancel!.label) : '';
  const label = one ? oneLabel : t('todo.cancelCount', { count: items.length });
  const title = one ? t('todo.confirmOne', { action: oneLabel, title: words!.title }) : t('todo.confirmMany', { count: items.length });
  const apps = [...new Set(items.map((i) => appName(i.app)))];
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>
            {one ? t('todo.keepIt') : t('todo.keepThem')}
          </button>
          <button type="button" className={primaryButton} data-todo-confirm="" onClick={onConfirm}>
            {label}
          </button>
        </>
      }
    >
      {one ? (
        <p className="text-base text-ink-soft">{t('todo.staysOne', { app: appName(one.app) })}</p>
      ) : (
        <>
          <p className="text-base text-ink-soft">{t('todo.staysMany', { apps: formatList(apps) })}</p>
          <ul className="mt-3 max-h-60 list-disc space-y-1 overflow-y-auto pl-5 text-base text-ink-soft">
            {items.map((i) => (
              <li key={i.id}>{todoWords(i).title}</li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}

const pulse = 'animate-pulse rounded bg-sunken motion-reduce:animate-none';

function Skeleton() {
  return (
    <section aria-busy="true" aria-label={t('common.loading')}>
      <p className="sr-only">{t('todo.loading')}</p>
      <ul className={`${cardClass} divide-y divide-line`} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex min-h-20 items-center gap-3 px-4 py-3 sm:px-5">
            <span className={`h-9 w-9 shrink-0 ${pulse} rounded-xl`} />
            <span className="flex-1 space-y-2">
              <span className={`block h-6 w-2/3 ${pulse}`} />
              <span className={`block h-4 w-1/3 ${pulse}`} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
