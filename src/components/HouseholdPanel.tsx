import { useEffect, useRef, useState, type FormEvent } from 'react';
import { inviteMailto, type Invitation } from '@huishouden/pwa-kit/invite';
import { cardClass, ghostButton, inputClass, linkClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { can, householdRole, roleDescription, roleLabel, type Role } from '@huishouden/pwa-kit/roles';
import { RoleList, RoleNote, RoleSelect } from '@huishouden/pwa-kit/react/roles';
import { MAX_NAME, type HubActions, type HubState, type ReadyHousehold } from '../hub';
import { useT } from '../i18n';
import { CurrencyPicker } from './CurrencyPicker';
import { HomeEditor } from '@huishouden/pwa-kit/react/home';

type SignedIn = Extract<HubState, { auth: 'signed-in' }>;

interface Props {
  state: SignedIn;
  actions: HubActions;
  notify: (message: string) => void;
  fail: (message: string) => void;
}

const textLink = 'min-h-11 font-medium text-link underline underline-offset-4 hover:text-forest-600 dark:hover:text-forest-200';

/**
 * The household: starting one, renaming it, who is in it (their own names and photos) with their
 * roles, and inviting more. Membership here is what every household app checks, so an invite opens
 * all of them at once. Only admins invite, remove and set roles; the rules refuse anyone else.
 */
export function HouseholdPanel({ state, actions, notify, fail }: Props) {
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
    <section id="household" aria-label={t('household.title')} aria-live="polite" className={`${cardClass} max-w-2xl p-6`}>
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
        <NoHousehold me={state.me} suggestedName={h.suggestedName} create={(name) =>
            run(async () => {
              await actions.createHousehold(name);
              setCreated(true);
            })
          }
        />
      )}
      {h.status === 'ready' && <Household key={h.id} me={state.me} household={h} actions={actions} run={run} focusInvite={created} />}
      <p className="mt-4 text-sm text-muted">
        <span translate="no">{t('household.signedInAs', { email: state.me })}</span> ·{' '}
        <button type="button" className="font-medium text-link underline underline-offset-4" onClick={() => void actions.signOut()}>
          {t('household.signOut')}
        </button>
      </p>
    </section>
  );
}

function NoHousehold({ me, suggestedName, create }: { me: string; suggestedName: string; create: (name: string) => Promise<void> }) {
  const t = useT();
  const [naming, setNaming] = useState(false);
  const [creating, setCreating] = useState(false);
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
    if (!trimmed || creating) return;
    setCreating(true);
    await create(trimmed.slice(0, MAX_NAME));
    setCreating(false);
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
}: {
  focusInvite: boolean;
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

  useEffect(() => {
    if (focusInvite) inviteInput.current?.focus();
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

  return (
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
                <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-600 font-semibold text-white">
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
      <CurrencyPicker value={h.currency} canChange={can(role, 'change-settings')} onChange={(code) => run(() => actions.setCurrency(code))} />
      <HomeEditor
        home={h.home}
        canChange={can(role, 'change-settings')}
        nameOf={nameOf}
        onSave={(home) => run(() => actions.setHome(home), t('home.saved'))}
        onRemove={() => run(() => actions.clearHome(), t('home.removed'))}
      />
    </>
  );
}
