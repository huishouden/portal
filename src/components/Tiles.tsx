import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Info } from 'lucide-react';
import { Dialog, ghostButton, primaryButton, useLongPress } from '@huishouden/pwa-kit/react/ui';
import { AppIcon as Icon } from './AppIcon';
import { arrangeTiles, layoutOf, sameLayout, type HouseholdApp, type PortalLayout } from '../apps';
import { t, useT } from '../i18n';
import { useWide } from './useWide';

interface Props {
  apps: HouseholdApp[];
  layout?: PortalLayout;
  /** A signed-in member of a household, who may arrange its tiles. */
  canArrange: boolean;
  /** Overdue things per app (by repo), shown on its tile. */
  overdue?: Record<string, number>;
  onSave: (layout: PortalLayout, previous: PortalLayout) => void;
}

const tileBase = 'flex flex-col gap-1.5 rounded-3xl bg-surface text-ink shadow-sm';

/**
 * Phones: a home-screen grid, the logo and a short name (four across, three on the narrowest), so
 * every app fits on one screen; what each one is lives in a sheet (a long press, or "What's each
 * app?"). Tablets: a card per app with its description.
 */
const gridClass = 'grid grid-cols-4 gap-x-1 gap-y-2 max-[374px]:grid-cols-3 sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] sm:gap-5';

/** A long press opens the app's details: phones only, where a right-click's menu isn't missed. */
function usePress(app: HouseholdApp, onDetails?: (app: HouseholdApp) => void) {
  const press = useLongPress(() => onDetails?.(app));
  return onDetails ? press : {};
}

/** Overdue things in the app, on its logo's corner. */
function Badge({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--hh-terracotta-dark)] px-1.5 text-xs font-semibold text-white ring-2 ring-page"
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

function Tile({ app, overdue = 0, onDetails }: { app: HouseholdApp; overdue?: number; onDetails?: (app: HouseholdApp) => void }) {
  const t = useT();
  const press = usePress(app, onDetails);
  return (
    <a
      href={app.url}
      data-app={app.repo}
      {...press}
      className={`group flex min-h-12 flex-col items-center gap-1.5 rounded-2xl px-0.5 pt-2 pb-1.5 text-center no-underline [-webkit-touch-callout:none] select-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracotta active:bg-tint sm:gap-1.5 sm:rounded-3xl sm:bg-surface sm:text-ink sm:shadow-sm sm:min-h-[180px] sm:items-start sm:border sm:border-line sm:px-6 sm:py-7 sm:text-left sm:transition-[box-shadow,transform] sm:duration-150 sm:ease-out sm:select-auto sm:hover:shadow-md sm:focus-visible:outline-offset-3 sm:active:scale-[0.98] sm:active:bg-surface`}
    >
      <span className="relative sm:mb-2">
        <Icon app={app} size={56} />
        {overdue > 0 && <Badge count={overdue} />}
      </span>
      <span className="line-clamp-2 w-full text-[0.8125rem] leading-tight font-medium text-ink [overflow-wrap:anywhere] sm:text-[1.375rem] sm:font-semibold sm:text-link">{app.name}</span>
      {overdue > 0 && <span className="sr-only">{t('today.appOverdue', { count: overdue })}</span>}
      <span className="text-muted max-sm:hidden">{app.description}</span>
    </a>
  );
}

function SmallTile({ app, onDetails }: { app: HouseholdApp; onDetails?: (app: HouseholdApp) => void }) {
  const press = usePress(app, onDetails);
  return (
    <a
      href={app.url}
      data-app={app.repo}
      {...press}
      className="flex min-h-12 flex-col items-center gap-1.5 rounded-2xl px-0.5 pt-2 pb-1.5 text-center text-[0.8125rem] leading-tight font-medium text-ink [-webkit-touch-callout:none] select-none active:bg-tint sm:min-h-14 sm:flex-row sm:gap-3 sm:border sm:border-line sm:bg-surface sm:px-4 sm:py-3 sm:text-left sm:text-base sm:font-semibold sm:text-link sm:shadow-sm sm:select-auto sm:hover:shadow-md"
    >
      <span className="sm:hidden">
        <Icon app={app} size={48} />
      </span>
      <span className="max-sm:hidden">
        <Icon app={app} size={36} />
      </span>
      <span className="line-clamp-2 w-full [overflow-wrap:anywhere] sm:w-auto">{app.name}</span>
    </a>
  );
}

/** What each app is: one app (a long press on its tile) or all of them ("What's each app?"). */
function AppDetails({ apps, onClose }: { apps: HouseholdApp[]; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog title={apps.length === 1 ? apps[0].name : t('tiles.whatEach')} onClose={onClose}>
      <ul className="-mx-2">
        {apps.map((a) => (
          <li key={a.repo}>
            <a href={a.url} className="flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2 no-underline hover:bg-tint">
              <Icon app={a} size={40} />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-link">{a.name}</span>
                <span className="text-sm text-muted">{a.description}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

/**
 * The app tiles in the household's order, its hidden apps under "More apps", and arranging them
 * (members only): earlier/later buttons, Hide/Show, and dragging with a mouse or trackpad. Escape or
 * Cancel discards; Done saves for everyone in the household.
 */
export function Tiles({ apps, layout, canArrange, overdue = {}, onSave }: Props) {
  const t = useT();
  const { all, shown, more } = arrangeTiles(apps, layout);
  const [arranging, setArranging] = useState(false);
  const [draft, setDraft] = useState<HouseholdApp[]>([]);
  const [draftHidden, setDraftHidden] = useState<Set<string>>(new Set());
  const [announce, setAnnounce] = useState('');
  const [dragging, setDragging] = useState<string>();
  const [dropTarget, setDropTarget] = useState<string>();
  const [focusKey, setFocusKey] = useState<string>();
  const [details, setDetails] = useState<HouseholdApp[]>();
  const wide = useWide();
  const root = useRef<HTMLDivElement>(null);
  const fine = typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches;

  useEffect(() => {
    if (!canArrange) setArranging(false);
  }, [canArrange]);

  // Focus stays on the control that was used, through re-renders and mode changes.
  useEffect(() => {
    if (!focusKey) return;
    root.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusKey)}"]`)?.focus();
    setFocusKey(undefined);
  }, [focusKey, arranging, draft, draftHidden]);

  const start = () => {
    setDraft(all);
    setDraftHidden(new Set(more.map((a) => a.repo)));
    setAnnounce('');
    setArranging(true);
    setFocusKey('title');
  };

  const stop = (save: boolean) => {
    const previous = layoutOf(all, more.map((a) => a.repo));
    const next = layoutOf(draft, draftHidden);
    setArranging(false);
    setFocusKey('arrange');
    if (save && !sameLayout(previous, next)) onSave(next, previous);
  };

  const move = (repo: string, to: number) => {
    const from = draft.findIndex((a) => a.repo === repo);
    if (from < 0 || to < 0 || to >= draft.length || from === to) return;
    const next = [...draft];
    const [app] = next.splice(from, 1);
    next.splice(to, 0, app);
    setDraft(next);
    setAnnounce(t('tiles.moved', { name: app.name, position: to + 1, total: next.length }));
  };

  if (!arranging) {
    return (
      <div ref={root}>
        <nav aria-label={t('tiles.label')}>
          <ul className={gridClass}>
            {shown.map((a) => (
              <li key={a.repo} className="flex flex-col [&>a]:flex-1">
                <Tile app={a} overdue={overdue[a.repo]} onDetails={wide ? undefined : (app) => setDetails([app])} />
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 sm:mt-3 sm:gap-y-2">
          {more.length > 0 && (
            <details className="group basis-full sm:flex-1 sm:basis-auto">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl px-1 font-medium text-link [&::-webkit-details-marker]:hidden">
                <ChevronRight size={18} aria-hidden="true" className="transition-transform duration-150 group-open:rotate-90" />
                {t('tiles.more')} <span className="text-muted">({more.length})</span>
              </summary>
              <nav aria-label={t('tiles.more')} className="mt-2">
                <ul className="grid grid-cols-4 gap-x-1 gap-y-2 max-[374px]:grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] sm:gap-3">
                  {more.map((a) => (
                    <li key={a.repo} className="flex flex-col [&>a]:flex-1">
                      <SmallTile app={a} onDetails={wide ? undefined : (app) => setDetails([app])} />
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
          )}
          <button type="button" className={`${ghostButton} -ml-3 text-link sm:hidden`} onClick={() => setDetails(all)}>
            <Info size={18} aria-hidden="true" /> {t('tiles.whatEach')}
          </button>
          {canArrange && (
            <button type="button" data-key="arrange" className={`${ghostButton} ml-auto`} onClick={start}>
              {t('tiles.arrange')}
            </button>
          )}
        </div>
        {details && <AppDetails apps={details} onClose={() => setDetails(undefined)} />}
      </div>
    );
  }

  const last = draft.length - 1;
  return (
    <div
      ref={root}
      className="@container"
      onKeyDown={(e) => {
        if (e.key === 'Escape') stop(false);
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <h2 tabIndex={-1} data-key="title" className="text-xl font-semibold text-link outline-none">
            {t('tiles.arrangeTitle')}
          </h2>
          <p className="text-muted">{t('tiles.arrangeHint')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={ghostButton} onClick={() => stop(false)}>
            {t('common.cancel')}
          </button>
          <button type="button" className={primaryButton} onClick={() => stop(true)}>
            {t('common.done')}
          </button>
        </div>
      </div>
      <ol aria-label={t('tiles.inOrder')} className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
        {draft.map((app, i) => {
          const hidden = draftHidden.has(app.repo);
          const drag = fine
            ? {
                draggable: true,
                onDragStart: (e: React.DragEvent) => {
                  setDragging(app.repo);
                  e.dataTransfer.setData('text/plain', app.repo);
                  e.dataTransfer.effectAllowed = 'move';
                },
                onDragEnd: () => {
                  setDragging(undefined);
                  setDropTarget(undefined);
                },
                onDragOver: (e: React.DragEvent) => {
                  if (!dragging || dragging === app.repo) return;
                  e.preventDefault();
                  setDropTarget(app.repo);
                },
                onDragLeave: () => setDropTarget((t) => (t === app.repo ? undefined : t)),
                onDrop: (e: React.DragEvent) => {
                  e.preventDefault();
                  if (dragging) move(dragging, i);
                  setDragging(undefined);
                  setDropTarget(undefined);
                },
              }
            : {};
          return (
            <li
              key={app.repo}
              {...drag}
              className={`${tileBase} px-5 pt-5 pb-3 ${fine ? 'cursor-grab' : ''} ${dragging === app.repo ? 'opacity-50' : ''} ${
                dropTarget === app.repo ? 'outline-3 outline-offset-3 outline-forest-500 outline-dashed' : ''
              } ${hidden ? 'border border-dashed border-stone-300 bg-transparent dark:border-forest-500 shadow-none' : 'border border-line'}`}
            >
              <span className={`mb-2 ${hidden ? 'opacity-45' : ''}`}>
                <Icon app={app} size={56} />
              </span>
              <span className="text-[1.375rem] font-semibold text-link">
                {app.name}
                {hidden && (
                  <span className="ml-1.5 rounded-full bg-stone-200 px-2 py-0.5 align-middle dark:bg-forest-700 text-xs font-medium text-muted">{t('tiles.hidden')}</span>
                )}
              </span>
              <span className="mb-2 text-muted">{hidden ? t('tiles.underMore') : app.description}</span>
              <span className="mt-auto flex items-center gap-1 border-t border-line pt-2">
                <MoveButton
                  dir="up"
                  app={app}
                  disabled={i === 0}
                  onClick={() => {
                    move(app.repo, i - 1);
                    setFocusKey(i - 1 === 0 ? `down:${app.repo}` : `up:${app.repo}`);
                  }}
                />
                <MoveButton
                  dir="down"
                  app={app}
                  disabled={i === last}
                  onClick={() => {
                    move(app.repo, i + 1);
                    setFocusKey(i + 1 === last ? `up:${app.repo}` : `down:${app.repo}`);
                  }}
                />
                <button
                  type="button"
                  data-key={`toggle:${app.repo}`}
                  aria-label={hidden ? t('tiles.showApp', { name: app.name }) : t('tiles.hideApp', { name: app.name })}
                  className={`${ghostButton} ml-auto text-link`}
                  onClick={() => {
                    const next = new Set(draftHidden);
                    if (next.delete(app.repo)) setAnnounce(t('tiles.shown', { name: app.name }));
                    else {
                      next.add(app.repo);
                      setAnnounce(t('tiles.hiddenAnnounce', { name: app.name }));
                    }
                    setDraftHidden(next);
                    setFocusKey(`toggle:${app.repo}`);
                  }}
                >
                  {hidden ? t('tiles.show') : t('tiles.hide')}
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" role="status">
        {announce}
      </p>
    </div>
  );
}

function MoveButton({ dir, app, disabled, onClick }: { dir: 'up' | 'down'; app: HouseholdApp; disabled: boolean; onClick: () => void }) {
  const Arrow = dir === 'up' ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      data-key={`${dir}:${app.repo}`}
      aria-label={dir === 'up' ? t('tiles.moveAppEarlier', { name: app.name }) : t('tiles.moveAppLater', { name: app.name })}
      title={dir === 'up' ? t('tiles.moveEarlier') : t('tiles.moveLater')}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-link hover:bg-tint disabled:text-stone-300 dark:disabled:text-forest-500 disabled:hover:bg-transparent"
    >
      {/* One column (phones): earlier is up, later is down. */}
      <Arrow size={20} strokeWidth={2.2} aria-hidden="true" className="@max-[499px]:rotate-90" />
    </button>
  );
}
