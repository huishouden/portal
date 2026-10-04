import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, UserPlus } from 'lucide-react';
import { groupContacts, type Contact, type ParsedContact } from '@huishouden/pwa-kit/contacts';
import { ContactCard, ContactDialog } from '@huishouden/pwa-kit/react/contacts';
import { can, type Role } from '@huishouden/pwa-kit/roles';
import { Checkbox, Chip, Dialog, cardClass, ghostButton, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { auth } from '../firebase';
import { contactRoleLabel, type HouseholdApp } from '../apps';
import type { HubActions } from '../hub';
import { useT } from '../i18n';

interface Props {
  contacts: Contact[] | undefined;
  /** The signed-in person (lowercase email) and their role: helpers and kids change only contacts they added. */
  me?: string;
  role?: Role | null;
  /** Every app in the household's order; the ones with contact roles show contacts. */
  apps: HouseholdApp[];
  actions: HubActions;
  notify: (message: string, undo?: () => void) => void;
  fail: (message: string) => void;
  /** Contact cards shared into the app: opened once as a new contact, filled in. */
  shared?: ParsedContact[] | null;
  onSharedOpened?: () => void;
}

type Filter = { kind: 'all' } | { kind: 'app'; repo: string } | { kind: 'none' };

const unique = (list: string[]) => [...new Map(list.map((r) => [r.toLowerCase(), r])).values()];

/**
 * Every contact the household keeps, whichever apps show it: grouped by role, tagged with its apps,
 * and added or edited with the same dialog the apps use. New contacts show in no app until chosen.
 */
export function ContactsScreen({ contacts, apps, actions, notify, fail, me, role = 'member', shared, onSharedOpened }: Props) {
  const t = useT();
  const mayChange = (c: Contact) => can(role, 'edit-others') || (!!me && c.by === me);
  const contactApps = useMemo(() => apps.filter((a) => a.contactRoles.length > 0), [apps]);
  const nameOf = useMemo(() => new Map(apps.map((a) => [a.repo, a.name])), [apps]);
  const allRoles = useMemo(() => unique(contactApps.flatMap((a) => a.contactRoles)), [contactApps]);
  // A short list for a contact not yet in any app: the first roles of each app.
  const commonRoles = useMemo(() => unique(contactApps.flatMap((a) => a.contactRoles.slice(0, 2))), [contactApps]);
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const [choosing, setChoosing] = useState<Contact | null>(null);
  const [sharedCards, setSharedCards] = useState<ParsedContact[] | undefined>();

  useEffect(() => {
    if (!shared) return;
    setSharedCards(shared);
    setEditing('new');
    onSharedOpened?.();
  }, [shared, onSharedOpened]);

  const run = (task: Promise<void>) => task.catch((e) => fail(e instanceof Error ? e.message : String(e)));

  const list = contacts ?? [];
  const unassigned = list.filter((c) => c.apps.length === 0).length;
  const shown = list.filter((c) => (filter.kind === 'all' ? true : filter.kind === 'none' ? c.apps.length === 0 : c.apps.includes(filter.repo)));
  const groups = groupContacts(shown, allRoles);

  const rolesFor = (c: Contact | 'new') => {
    const repos = c === 'new' ? (filter.kind === 'app' ? [filter.repo] : []) : c.apps;
    const roles = unique(contactApps.filter((a) => repos.includes(a.repo)).flatMap((a) => a.contactRoles));
    return roles.length ? roles : commonRoles;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-ink">{t('contacts.title')}</h2>
        <button type="button" className={primaryButton} onClick={() => setEditing('new')}>
          <UserPlus size={20} aria-hidden="true" /> {t('contacts.add')}
        </button>
      </div>

      {list.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('contacts.showFrom')}>
          <Chip active={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all' })}>
            {t('contacts.all')}
          </Chip>
          {contactApps.map((a) => (
            <Chip key={a.repo} active={filter.kind === 'app' && filter.repo === a.repo} onClick={() => setFilter({ kind: 'app', repo: a.repo })}>
              {a.name}
            </Chip>
          ))}
          {unassigned > 0 && (
            <Chip active={filter.kind === 'none'} onClick={() => setFilter({ kind: 'none' })}>
              {t('contacts.notInApp')}
            </Chip>
          )}
        </div>
      )}

      {contacts === undefined && <p className="text-lg text-muted">{t('contacts.loading')}</p>}
      {contacts !== undefined && list.length === 0 && (
        <p className={`${cardClass} p-6 text-lg text-muted`}>
          {t('contacts.empty')}
        </p>
      )}
      {list.length > 0 && shown.length === 0 && <p className="text-lg text-muted">{t('contacts.emptyFilter')}</p>}

      <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
        {groups.flatMap((g) =>
          g.contacts.map((c) => (
            <div key={c.id} className="flex flex-col [&>section]:rounded-b-none [&>section]:border-b-0 [&>section]:shadow-none">
              <ContactCard
                contact={c}
                role={contactRoleLabel(g.role)}
                onEdit={mayChange(c) ? () => setEditing(c) : undefined}
                onDelete={
                  mayChange(c)
                    ? () => {
                        void run(actions.deleteContact(c));
                        notify(t('common.deleted', { name: c.name }), () => void run(actions.restoreContact(c)));
                      }
                    : undefined
                }
              />
              <div className="rounded-b-2xl border border-t-0 border-line bg-surface px-5 pb-2 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
                <span className="flex min-w-0 flex-1 flex-wrap gap-1.5" aria-label={t('contacts.appsThatShow', { name: c.name })}>
                  {c.apps.length === 0 ? (
                    <span className="text-sm text-muted">{t('contacts.notShown')}</span>
                  ) : (
                    c.apps.map((repo) => (
                      <span key={repo} className="rounded-full bg-tint px-2.5 py-0.5 text-sm font-medium text-link">
                        {nameOf.get(repo) ?? repo}
                      </span>
                    ))
                  )}
                </span>
                {mayChange(c) && (
                  <button type="button" className={`${ghostButton} text-link`} onClick={() => setChoosing(c)} aria-label={t('contacts.chooseApps', { name: c.name })}>
                    <LayoutGrid size={18} aria-hidden="true" /> {t('contacts.apps')}
                  </button>
                )}
                </div>
              </div>
            </div>
          )),
        )}
      </div>

      {editing && (
        <ContactDialog
          contact={editing === 'new' ? null : editing}
          app=""
          roles={rolesFor(editing)}
          roleLabel={(r) => contactRoleLabel(r)}
          namePlaceholder={t('contacts.namePlaceholder')}
          auth={auth}
          sharedContacts={editing === 'new' ? sharedCards : undefined}
          canMarkPrivate={can(role, 'see-private')}
          onSave={(input) => {
            if (editing === 'new') {
              const apps = filter.kind === 'app' ? [filter.repo] : [];
              void run(actions.addContact({ ...input, apps }));
              notify(apps.length ? t('contacts.addedTo', { name: input.name, app: nameOf.get(apps[0]) ?? apps[0] }) : t('common.added', { name: input.name }));
            } else void run(actions.updateContact(editing.id, { ...input, apps: editing.apps }));
          }}
          onDelete={
            editing === 'new'
              ? undefined
              : () => {
                  void run(actions.deleteContact(editing));
                  notify(t('common.deleted', { name: editing.name }), () => void run(actions.restoreContact(editing)));
                }
          }
          onClose={() => {
            setEditing(null);
            setSharedCards(undefined);
          }}
        />
      )}
      {choosing && (
        <AppPicker
          contact={choosing}
          apps={contactApps}
          onSave={(chosen) => {
            const { id, createdAt: _c, updatedAt: _u, by: _b, ...input } = choosing;
            void run(actions.updateContact(id, { ...input, apps: chosen }));
          }}
          onClose={() => setChoosing(null)}
        />
      )}
    </div>
  );
}

/** Which apps show a contact; it stays in the household's contacts either way. */
function AppPicker({ contact, apps, onSave, onClose }: { contact: Contact; apps: HouseholdApp[]; onSave: (apps: string[]) => void; onClose: () => void }) {
  const t = useT();
  const [chosen, setChosen] = useState(() => new Set(contact.apps));
  return (
    <Dialog
      title={t('contacts.showIn', { name: contact.name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ghostButton} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={primaryButton}
            onClick={() => {
              // Keeps apps it was in that don't list contacts here, so nothing is dropped unseen.
              const others = contact.apps.filter((r) => !apps.some((a) => a.repo === r));
              onSave([...apps.filter((a) => chosen.has(a.repo)).map((a) => a.repo), ...others]);
              onClose();
            }}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <p className="mb-3 text-muted">{t('contacts.pickerNote')}</p>
      <div className="grid gap-1">
        {apps.map((a) => (
          <Checkbox
            key={a.repo}
            checked={chosen.has(a.repo)}
            onChange={(on) => {
              const next = new Set(chosen);
              if (on) next.add(a.repo);
              else next.delete(a.repo);
              setChosen(next);
            }}
          >
            <span className="font-medium">{a.name}</span> <span className="text-muted">· {a.description}</span>
          </Checkbox>
        ))}
      </div>
    </Dialog>
  );
}
