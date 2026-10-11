import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ASSISTANT_PATH, CALENDAR_SETTINGS_PATH } from '@huishouden/pwa-kit/app-bar';
import { isCurrencyCode } from '@huishouden/pwa-kit/money';
import { inviteMailto, type Invitation } from '@huishouden/pwa-kit/invite';
import { cardClass, ghostButton, inputClass, linkClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { can, householdRole, roleDescription, roleLabel, type Role } from '@huishouden/pwa-kit/roles';
import { RoleList, RoleNote, RoleSelect } from '@huishouden/pwa-kit/react/roles';
import { MAX_NAME, type HubActions, type HubState, type ReadyHousehold } from '../hub';
import { useLocale, useT } from '../i18n';
import { CurrencyPicker, currencyName } from './CurrencyPicker';
import { useWide } from './useWide';
import { HomeEditor } from '@huishouden/pwa-kit/react/home';

type SignedIn = Extract<HubState, { auth: 'signed-in' }>;

interface Props {
  state: SignedIn;
  actions: HubActions;
  notify: (message: string) => void;
  fail: (message: string) => void;
  /** Opens a page outside the tabs: the AI assistant, or the household in your own calendar. */
  onOpenPage: (path: string) => void;
}

/** The household's sections a phone folds into rows; `/apps#household-<section>` opens one. */
type Section = 'members' | 'home' | 'currency';
const SECTIONS: Section[] = ['members', 'home', 'currency'];

/** The section a link opens: `#household-home` and friends, and plain `#household` (apps send it to set the home). */
export function sectionFromHash(hash: string): Section | undefined {
  if (hash === '#household') return 'home';
  const id = hash.replace(/^#household-/, '') as Section;
  return hash.startsWith('#household-') && SECTIONS.includes(id) ? id : undefined;
}

const textLink = 'min-h-11 font-medium text-link underline underline-offset-4 hover:text-forest-600 dark:hover:text-forest-200';

/**
 * The household: starting one, renaming it, who is in it (their own names and photos) with their
 * roles, and inviting more. Membership here is what every household app checks, so an invite opens
 * all of them at once. Only admins invite, remove and set roles; the rules refuse anyone else.
 */
export function HouseholdPanel({ state, actions, notify, fail, onOpenPage }: Props) {
  const t = useT();
  const h = state.household;
  // Right after starting a household, land on the invite field.
  const [created, setCreated] = useState(false);
  const run = async (task: () => Promise<void>, done?: string) => {
    try {
      await task();
      if (done) notify(done);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section id="household" aria-label={t('household.title')} aria-live="polite" className={`${cardClass} max-w-2xl scroll-mt-24 p-4 sm:p-6`}>
      {h.status === 'loading' && (
        <>
          <h2 className="mb-3 text-xl font-semibold text-link">{t('household.title')}</h2>
          <p className="text-muted">{t('common.loading')}</p>
        </>
      )}
      {h.status === 'error' && (
        <>
          <h2 className="mb-3 text-xl font-semibold text-link">{t('household.title')}</h2>
          <p className="text-error">{h.error}</p>
        </>
      )}
      {h.status === 'none' && (
        <NoHousehold me={state.me} suggestedName={h.suggestedName} create={async (name) => {
            let ok = false;
            await run(async () => {
              await actions.createHousehold(name);
              setCreated(true);
              ok = true;
            });
            return ok;
          }}
        />
      )}
      {h.status === 'ready' && <Household key={h.id} me={state.me} household={h} actions={actions} run={run} focusInvite={created} onOpenPage={onOpenPage} />}
      <p className="mt-4 text-sm text-muted">
        <span translate="no">{t('household.signedInAs', { email: state.me })}</span> ·{' '}
        <button type="button" className="font-medium text-link underline underline-offset-4" onClick={() => void actions.signOut()}>
          {t('household.signOut')}
        </button>
      </p>
    </section>
  );
}

function NoHousehold({ me, suggestedName, create }: { me: string; suggestedName: string; create: (name: string) => Promise<boolean> }) {
  const t = useT();
  const [naming, setNaming] = useState(false);
  const [creating, setCreating] = useState(false);
  // Set synchronously: two taps in one frame both see `creating` false, and `creating` must stay true
  // after a success until the household arrives, or the button comes back before the page changes.
  const tapped = useRef(false);
  const [name, setName] = useState(suggestedName);
  const input = useRef<HTMLInputElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (naming) {
      input.current?.focus();
      input.current?.select();
    }
  }, [naming]);

  const [waitBefore, waitAfter = ''] = t('household.waiting', { email: '\u0000' }).split('\u0000');
  const waiting = (
    <p className="mt-3 text-sm text-muted">
      {waitBefore}
      <strong translate="no">{me}</strong>
      {waitAfter}
    </p>
  );

  if (!naming) {
    return (
      <>
        <h2 className="mb-3 text-xl font-semibold text-link">{t('household.title')}</h2>
        <p className="mb-3">{t('household.startHint')}</p>
        <button ref={startButton} type="button" className={primaryButton} onClick={() => setNaming(true)}>
          {t('household.start')}
        </button>
        {waiting}
      </>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating || tapped.current) return;
    tapped.current = true;
    setCreating(true);
    if (!(await create(trimmed.slice(0, MAX_NAME)))) {
      tapped.current = false;
      setCreating(false);
    }
  };

  return (
    <>
      <h2 className="mb-3 text-xl font-semibold text-link">{t('household.start')}</h2>
      <form onSubmit={submit} className="mb-3">
        <label htmlFor="hh-new-name" className="mb-1.5 block font-medium">
          {t('common.name')}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id="hh-new-name"
            className={`${inputClass} min-w-[220px] flex-1`}
            value={name}
            maxLength={MAX_NAME}
            required
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className={primaryButton} disabled={creating}>
            {creating ? t('household.starting') : t('household.startShort')}
          </button>
          <button type="button" className={ghostButton} disabled={creating} onClick={() => setNaming(false)}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
      <p className="text-sm text-muted">{t('household.onlyYou')}</p>
      {waiting}
    </>
  );
}

function Household({
  me,
  household: h,
  actions,
  run,
  focusInvite,
  onOpenPage,
}: {
  focusInvite: boolean;
  onOpenPage: (path: string) => void;
  me: string;
  household: ReadyHousehold;
  actions: HubActions;
  run: (task: () => Promise<void>, done?: string) => Promise<void>;
}) {
  const t = useT();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(h.name);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [invited, setInvited] = useState<Invitation>();
  const [sending, setSending] = useState(false);
  const renameInput = useRef<HTMLInputElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const inviteInput = useRef<HTMLInputElement>(null);
  const solo = h.members.length === 1;
  const role = householdRole(h, me);
  const admin = can(role, 'manage-people');
  const nameOf = (m: string) => h.profiles[m]?.name ?? m;
  const wide = useWide();
  const locale = useLocale();
  const currency = isCurrencyCode(h.currency) ? h.currency : 'USD';
  // Phones: one section open at a time, the one a link asked for, or the members right after starting.
  const [open, setOpen] = useState<Section | undefined>(() => (focusInvite ? 'members' : sectionFromHash(location.hash)));

  useEffect(() => {
    if (!focusInvite) return;
    setOpen('members');
    setTimeout(() => inviteInput.current?.focus());
  }, [focusInvite]);

  useEffect(() => {
    if (renaming) {
      renameInput.current?.focus();
      renameInput.current?.select();
    }
  }, [renaming]);

  const stopRenaming = () => {
    setRenaming(false);
    setTimeout(() => renameButton.current?.focus());
  };

  const header = (
    <>
      {renaming ? (
        <form
          className="mb-3"
          onKeyDown={(e) => e.key === 'Escape' && stopRenaming()}
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim();
            if (name && name !== h.name) void run(() => actions.renameHousehold(name));
            stopRenaming();
          }}
        >
          <label htmlFor="hh-rename-name" className="mb-1.5 block font-medium">
            {t('household.nameLabel')}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              ref={renameInput}
              id="hh-rename-name"
              className={`${inputClass} min-w-[220px] flex-1`}
              value={newName}
              maxLength={MAX_NAME}
              required
              autoComplete="off"
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className={primaryButton}>
              {t('common.save')}
            </button>
            <button type="button" className={ghostButton} onClick={stopRenaming}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-1 flex items-baseline gap-3">
          <h2 className="text-xl font-semibold text-link" translate="no">{h.name}</h2>
          {can(role, 'change-settings') && (
            <button
              ref={renameButton}
              type="button"
              className={`${textLink} text-sm`}
              onClick={() => {
                setNewName(h.name);
                setRenaming(true);
              }}
            >
              {t('household.rename')}
            </button>
          )}
        </div>
      )}
    </>
  );
  const membersBlock = (
    <>
      <ul className="mb-4">
        {h.members.map((m) => {
          const p = h.profiles[m];
          const joined = h.joined.includes(m);
          const self = m === me;
          const theirs = householdRole(h, m) ?? 'member';
          return (
            <li key={m} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2.5">
              {p?.photoURL ? (
                <img className="h-10 w-10 shrink-0 rounded-full object-cover" src={p.photoURL} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-600 font-semibold text-white ring-1 ring-tile-ring">
                  {(p?.name ?? m).charAt(0).toUpperCase()}
                </span>
              )}
              <span className="flex min-w-0 flex-1 basis-48 flex-col [overflow-wrap:anywhere]">
                <span className="font-semibold">
                  <span translate="no">{p?.name ?? m}</span>
                  {self && <span className="font-normal text-muted"> {t('household.you')}</span>}
                </span>
                {p?.name && <span className="text-sm text-muted" translate="no">{m}</span>}
                {!(admin && !self) && <span className="text-sm text-muted">{roleLabel(theirs)}</span>}
              </span>
              {admin && !self && (
                <RoleSelect
                  value={theirs}
                  label={t('household.roleFor', { name: nameOf(m) })}
                  onChange={(next) => void run(() => actions.setRole(m, next), t('household.roleChanged', { name: nameOf(m), role: next }))}
                />
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${joined ? 'bg-tint-strong text-link' : 'bg-attention-tint text-attention'}`}
              >
                {joined ? t('household.joined') : t('household.invited')}
              </span>
              {admin && !self && (
                <button
                  type="button"
                  className={textLink}
                  onClick={() => {
                    if (confirm(t('household.removeConfirm', { email: m, household: h.name }))) void run(() => actions.removeMember(m));
                  }}
                >
                  {t('common.remove')}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {invited && (
        <div role="status" className="mb-4 rounded-xl bg-tint p-4">
          <p className="mb-2">{t('household.invitedNote', { email: invited.to })}</p>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={primaryButton}
              disabled={sending}
              onClick={async () => {
                setSending(true);
                await run(async () => {
                  await actions.sendInviteEmail(invited);
                  setInvited(undefined);
                }, t('household.inviteSent'));
                setSending(false);
              }}
            >
              {sending ? t('household.sending') : t('household.sendInvite')}
            </button>
            <a className={linkClass} href={inviteMailto(invited)}>
              {t('household.mailApp')}
            </a>
            <button type="button" className={`${textLink} inline-flex items-center`} onClick={() => setInvited(undefined)}>
              {t('household.notNow')}
            </button>
          </div>
          <p className="text-sm text-muted">{t('household.gmailNote')}</p>
        </div>
      )}

      {admin ? (
        <details className="mb-4">
          <summary className={`${textLink} inline-flex cursor-pointer items-center`}>{t('household.whatRoles')}</summary>
          <div className="mt-2">
            <RoleList />
          </div>
        </details>
      ) : (
        role && (
          <p className="mb-4 text-sm text-muted">
            {t('household.yourRole', { role, description: roleDescription(role) })}
          </p>
        )
      )}

      {!admin && <RoleNote action="manage-people" />}
      {admin && solo && <p className="mb-3">{t('household.inviteHint')}</p>}
      {admin && (
      <form
        className="mb-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const to = email.trim();
          if (!to) return;
          void run(async () => {
            const invitation = await actions.invite(to, inviteRole);
            setEmail('');
            setInviteRole('member');
            setInvited(invitation);
          });
        }}
      >
        <input
          ref={inviteInput}
          type="email"
          className={`${inputClass} min-w-[220px] flex-1`}
          placeholder={t('household.inviteEmail')}
          aria-label={t('household.inviteEmail')}
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <RoleSelect value={inviteRole} label={t('household.theirRole')} onChange={setInviteRole} />
        <button type="submit" className={primaryButton}>
          {t('household.invite')}
        </button>
      </form>
      )}
      {admin && !solo && <p className="text-sm text-muted">{t('household.inviteNote')}</p>}
    </>
  );
  const currencyBlock = (
      <CurrencyPicker value={h.currency} canChange={can(role, 'change-settings')} onChange={(code) => run(() => actions.setCurrency(code))} />
  );
  const homeBlock = (
      <HomeEditor
        home={h.home}
        canChange={can(role, 'change-settings')}
        nameOf={nameOf}
        onSave={(home) => run(() => actions.setHome(home), t('home.saved'))}
        onRemove={() => run(() => actions.clearHome(), t('home.removed'))}
      />
  );

  if (wide)
    return (
      <>
        {header}
        {membersBlock}
        {currencyBlock}
        {homeBlock}
      </>
    );

  const toggle = (section: Section) => setOpen((o) => (o === section ? undefined : section));
  const joinedNames = h.members.map((m) => nameOf(m).split(/[\s@]/)[0]).join(', ');
  return (
    <>
      {header}
      <ul className="-mx-4 mt-3 border-t border-line">
        <FoldRow id="household-members" label={t('household.members')} summary={joinedNames} open={open === 'members'} onToggle={() => toggle('members')}>
          {membersBlock}
        </FoldRow>
        <FoldRow
          id="household-home"
          label={t('household.home')}
          summary={h.home?.address ?? t('household.homeNotSet')}
          open={open === 'home'}
          onToggle={() => toggle('home')}
          className="[&>div]:mt-0 [&>div]:border-0 [&>div]:pt-0 [&_h3]:sr-only"
        >
          {homeBlock}
        </FoldRow>
        <FoldRow
          id="household-currency"
          label={t('currency.label')}
          summary={t('currency.option', { name: currencyName(currency, locale), code: currency })}
          open={open === 'currency'}
          onToggle={() => toggle('currency')}
          className="[&>div]:mt-0 [&>div]:border-0 [&>div]:pt-0 [&_label]:sr-only"
        >
          {currencyBlock}
        </FoldRow>
        <LinkRow path={ASSISTANT_PATH} label={t('assistant.connectedTitle')} summary={t('household.assistantSummary')} onOpenPage={onOpenPage} />
        <LinkRow path={CALENDAR_SETTINGS_PATH} label={t('myCalendar.title')} summary={t('household.calendarSummary')} onOpenPage={onOpenPage} />
      </ul>
    </>
  );
}

const rowButton = 'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left no-underline hover:bg-tint focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-terracotta';

function RowText({ label, summary }: { label: string; summary: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="font-semibold text-ink">{label}</span>
      <span className="truncate text-sm text-muted" translate="no">
        {summary}
      </span>
    </span>
  );
}

/** A phone's row for one of the household's sections: its name and what it's set to, opening in place. */
function FoldRow({ id, label, summary, open, onToggle, className = '', children }: { id: string; label: string; summary: string; open: boolean; onToggle: () => void; className?: string; children: ReactNode }) {
  return (
    <li className="border-b border-line">
      <button type="button" className={rowButton} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <RowText label={label} summary={summary} />
        <ChevronDown size={20} aria-hidden="true" className={`shrink-0 text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={id} role="region" aria-label={label} className={`px-4 pb-4 ${className}`}>
          {children}
        </div>
      )}
    </li>
  );
}

/** A phone's row for a page of its own (the AI assistant, your own calendar). */
function LinkRow({ path, label, summary, onOpenPage }: { path: string; label: string; summary: string; onOpenPage: (path: string) => void }) {
  return (
    <li className="border-b border-line">
      <a
        href={path}
        className={rowButton}
        onClick={(e) => {
          e.preventDefault();
          onOpenPage(path);
        }}
      >
        <RowText label={label} summary={summary} />
        <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-muted" />
      </a>
    </li>
  );
}
