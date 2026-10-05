import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { setDoc, updateDoc } from '@huishouden/pwa-kit/firestore';
import { signInSilently } from '@huishouden/pwa-kit/auth';
import {
  createHousehold,
  inviteMember,
  markJoined,
  normalizeEmail,
  removeMember,
  saveMyProfile,
  clearHouseholdHome,
  setHouseholdCurrency,
  setHouseholdHome,
  watchHousehold,
  watchProfiles,
  type HouseholdState,
  type Profile,
} from '@huishouden/pwa-kit/household';
import { addContact, deleteContact, markUnflaggedOpen, restoreContact, updateContact, watchContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import { can, householdRole, isRestricted, setRole } from '@huishouden/pwa-kit/roles';
import { sendInviteEmail } from '@huishouden/pwa-kit/invite';
import { agendaRange, watchAgenda, type AgendaItem } from '@huishouden/pwa-kit/agenda';
import { applyTodo, TodoActionError, todoWords, watchTodos, type TodoItem } from '@huishouden/pwa-kit/todos';
import { toYmd } from '@huishouden/pwa-kit/time';
import { saveFood, watchFood, type FoodPreferences } from '@huishouden/pwa-kit/food';
import { googleAccessMessage, readError } from '@huishouden/pwa-kit/feedback';
import { track } from '@huishouden/pwa-kit/observability';
import { DEFAULT_LAYOUT, parseLayout, type PortalLayout } from '../apps';
import { auth, db, googleClientId, signInWithGoogle, signOutEverywhere } from '../firebase';
import { rememberHousehold, rememberedHousehold } from '../memberHint';
import { MAX_NAME, suggestedHouseholdName, type HouseholdView, type HubActions, type HubState } from '../hub';
import { t } from '../i18n';

const LAYOUT_CACHE = 'hh-portal-layout';

const storage = (): Storage | undefined => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
};

/** The last layout this browser saw, so a member's tiles don't jump while sign-in resolves. */
function cachedLayout(): PortalLayout | undefined {
  try {
    const raw = localStorage.getItem(LAYOUT_CACHE);
    return raw ? parseLayout(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

function cacheLayout(layout: PortalLayout | undefined) {
  try {
    if (layout) localStorage.setItem(LAYOUT_CACHE, JSON.stringify(layout));
    else localStorage.removeItem(LAYOUT_CACHE);
  } catch {
    // Private browsing without storage: the tiles still follow the household, just after sign-in.
  }
}

/** Apps publish 180 days ahead (`AGENDA_AHEAD_DAYS`); the Calendar tab reads all of it. */
export const AGENDA_DAYS = 181;
/**
 * Today and Apps look a week ahead, so the rest of the time the hub follows only that: a listener
 * is billed its whole result again after 30 minutes disconnected (the kitchen tablet waking), so the
 * narrower window is what a wake costs (pwa-kit docs/one-site.md "Budgets").
 */
export const AGENDA_WEEK_DAYS = 8;

/** Today's date, changing at midnight (checked every minute). */
function useToday() {
  const [today, setToday] = useState(() => toYmd(Date.now()));
  useEffect(() => {
    const id = setInterval(() => setToday(toYmd(Date.now())), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

const words = (e: unknown, doing: string) => new Error(readError(e, doing));

/**
 * The hub's live data: sign-in, the household (members, their own names and photos), its tile
 * layout (`settings/portal`) and every household contact, with the actions that change them.
 */
export function useLiveHub(agendaDays: number = AGENDA_DAYS): { state: HubState; actions: HubActions } {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [household, setHousehold] = useState<HouseholdState>({ status: 'loading' });
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [layout, setLayout] = useState<PortalLayout | undefined>(cachedLayout);
  const [contacts, setContacts] = useState<Contact[] | undefined>(undefined);
  const [agenda, setAgenda] = useState<AgendaItem[] | undefined>(undefined);
  const [food, setFood] = useState<FoodPreferences | undefined>(undefined);
  const [todos, setTodos] = useState<TodoItem[] | undefined>(undefined);
  const [remembered, setRemembered] = useState(() => rememberedHousehold(storage()) !== undefined);
  const today = useToday();

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (!u) {
          setLayout(undefined);
          cacheLayout(undefined);
          rememberHousehold(storage(), undefined);
          setRemembered(false);
        }
      }),
    [],
  );

  // Signs in without a click when the browser is signed in to Google and has used this site before.
  useEffect(() => {
    if (googleClientId) void signInSilently(auth, googleClientId);
  }, []);

  const email = user?.email ? normalizeEmail(user.email) : undefined;
  useEffect(() => {
    setHousehold({ status: 'loading' });
    if (!email) return;
    return watchHousehold(db, email, setHousehold);
  }, [email]);

  const ready = household.status === 'ready' ? household.household : undefined;
  const householdId = ready?.id;
  const role = householdRole(ready, email);
  // Helpers and kids may read only contacts and agenda items not marked private, and must ask for just those.
  const restricted = isRestricted(role);
  const seesPrivate = can(role, 'see-private');

  // Remember on this device whether a member is signed in, for the next load (src/memberHint.ts).
  useEffect(() => {
    if (householdId) rememberHousehold(storage(), householdId);
    else if (household.status === 'none') {
      rememberHousehold(storage(), undefined);
      setRemembered(false);
    }
  }, [householdId, household.status]);

  useEffect(() => {
    if (ready && email) markJoined(db, ready, email).catch(() => {});
  }, [ready, email]);

  useEffect(() => {
    setProfiles(new Map());
    setContacts(undefined);
    setFood(undefined);
    if (!householdId || !user) return;
    // Members' names and photos come from their own sign-ins; record ours for the others.
    saveMyProfile(db, householdId, user).catch(() => {});
    const stops = [
      watchProfiles(db, householdId, setProfiles),
      watchContacts(db, householdId, setContacts, { restricted, by: email, backfillPositions: true, onError: () => setContacts([]) }),
      watchFood(db, householdId, setFood),
      onSnapshot(
        doc(db, 'households', householdId, 'settings', 'portal'),
        (snap) => {
          const next = snap.exists() ? parseLayout(snap.data()) : DEFAULT_LAYOUT;
          cacheLayout(next);
          setLayout(next);
        },
        () => {
          // Unreadable (offline): keep what is shown.
        },
      ),
    ];
    return () => stops.forEach((stop) => stop());
  }, [householdId, user, restricted]);

  // Contacts saved before the private flag are hidden from helpers and kids until written with
  // `private: false`; an admin's or member's portal does that once.
  useEffect(() => {
    if (!householdId || !seesPrivate || !contacts?.some((c) => c.private === undefined)) return;
    markUnflaggedOpen(db, householdId, 'contacts', contacts).catch(() => {});
  }, [householdId, seesPrivate, contacts]);

  // The agenda from a week ago (overdue items whatever their age) to `agendaDays` ahead (as far as
  // apps publish on the Calendar tab), followed again each new day so a tablet left open keeps the
  // right window.
  useEffect(() => {
    setAgenda(undefined);
    if (!householdId) return;
    const { from, to } = agendaRange(Date.now(), agendaDays, 7);
    // With `me`, the items for named people only that name this member (Health's medicines).
    return watchAgenda(db, householdId, { from, to, restricted, me: email, onError: () => setAgenda([]) }, setAgenda);
  }, [householdId, today, restricted, email, agendaDays]);

  // Every app's open things to do; helpers and kids ask for the open ones only.
  useEffect(() => {
    setTodos(undefined);
    if (!householdId) return;
    return watchTodos(db, householdId, { restricted, me: email, onError: () => setTodos([]) }, setTodos);
  }, [householdId, restricted, email]);

  const state = useMemo((): HubState => {
    if (user === undefined) return { auth: 'starting', layout, remembered };
    if (!user?.email) return { auth: 'signed-out' };
    const me = normalizeEmail(user.email);
    let view: HouseholdView;
    if (household.status === 'loading') view = { status: 'loading' };
    else if (household.status === 'error') view = { status: 'error', error: household.error.message };
    else if (household.status === 'none') view = { status: 'none', suggestedName: suggestedHouseholdName(user.displayName) };
    else {
      const h = household.household;
      view = {
        status: 'ready',
        id: h.id,
        name: h.name,
        members: h.members,
        joined: h.joined,
        roles: h.roles ?? {},
        ...(h.currency ? { currency: h.currency } : {}),
        ...(h.home ? { home: h.home } : {}),
        profiles: Object.fromEntries([...profiles].map(([k, p]) => [k, { name: p.name, photoURL: p.photoURL }])),
      };
    }
    return {
      auth: 'signed-in',
      remembered,
      user: { name: user.displayName, email: user.email, photoURL: user.photoURL },
      me,
      household: view,
      layout: view.status === 'ready' ? layout : undefined,
      contacts,
      agenda,
      food,
      todos,
    };
  }, [user, household, profiles, layout, contacts, agenda, food, todos, remembered]);

  const actions = useMemo((): HubActions => {
    const need = () => {
      if (!householdId || !email) throw new Error(t('error.noHousehold'));
      return { id: householdId, me: email };
    };
    return {
      async signIn() {
        try {
          await signInWithGoogle();
        } catch (e) {
          const code = (e as { code?: string }).code;
          if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
          throw new Error(t('error.signIn'));
        }
      },
      signOut: signOutEverywhere,
      async createHousehold(name) {
        if (!email) return;
        await createHousehold(db, email, name.slice(0, MAX_NAME)).catch((e) => {
          throw words(e, t('error.createHousehold'));
        });
        track('create household');
      },
      async renameHousehold(name) {
        const { id } = need();
        await updateDoc(doc(db, 'households', id), { name: name.slice(0, MAX_NAME) }).catch((e) => {
          throw words(e, t('error.renameHousehold'));
        });
      },
      async invite(to, inviteRole) {
        const { me } = need();
        const address = normalizeEmail(to);
        await inviteMember(db, ready!, address, inviteRole).catch((e) => {
          throw e instanceof Error && !('code' in e) ? e : words(e, t('error.invite'));
        });
        track('invite member');
        return {
          to: address,
          from: profiles.get(me)?.name ?? user?.displayName ?? me,
          householdName: ready?.name ?? t('household.theHousehold'),
          url: location.origin,
        };
      },
      async removeMember(who) {
        need();
        await removeMember(db, ready!, who).catch((e) => {
          throw words(e, t('error.remove'));
        });
      },
      async setRole(who, next) {
        need();
        await setRole(db, ready!, who, next).catch((e) => {
          throw words(e, t('error.role'));
        });
      },
      async sendInviteEmail(invitation) {
        try {
          await sendInviteEmail(auth, invitation);
          track('send invite email');
        } catch (e) {
          throw new Error(googleAccessMessage(e, 'Gmail') ?? (e instanceof Error ? e.message : String(e)));
        }
      },
      async saveLayout(next) {
        const { id, me } = need();
        const previous = layout;
        setLayout(next);
        try {
          await setDoc(doc(db, 'households', id, 'settings', 'portal'), { ...next, updatedAt: Date.now(), by: me });
          track('arrange apps');
        } catch (e) {
          setLayout(previous);
          throw words(e, t('error.layout'));
        }
      },
      async addContact(input) {
        const { id, me } = need();
        await addContact(db, id, input, me).catch((e) => {
          throw words(e, t('error.addContact'));
        });
        track('add contact');
      },
      async updateContact(contactId, input) {
        const { id, me } = need();
        await updateContact(db, id, contactId, input, me).catch((e) => {
          throw words(e, t('error.saveContact'));
        });
      },
      async deleteContact(contact) {
        const { id } = need();
        await deleteContact(db, id, contact.id, { pay: !!contact.pay }).catch((e) => {
          throw words(e, t('error.deleteContact'));
        });
      },
      async setCurrency(code) {
        const { id } = need();
        await setHouseholdCurrency(db, id, code).catch((e) => {
          throw words(e, t('error.currency'));
        });
        track('set currency');
      },
      async setHome(home) {
        const { id, me } = need();
        await setHouseholdHome(db, id, home, me).catch((e) => {
          throw words(e, t('error.home'));
        });
        track('set home', { approximate: home.approximate === true });
      },
      async clearHome() {
        const { id } = need();
        await clearHouseholdHome(db, id).catch((e) => {
          throw words(e, t('error.home'));
        });
        track('clear home');
      },
      async saveFood(input) {
        const { id, me } = need();
        await saveFood(db, id, input, me).catch((e) => {
          throw words(e, t('error.food'));
        });
        track('save food preferences');
      },
      async runTodo(item, which) {
        const { id, me } = need();
        try {
          const run = await applyTodo(db, id, item, which, { me });
          track(which === 'done' ? 'todo done' : 'todo cancel', { app: item.app });
          return {
            written: run.written.catch((e) => {
              throw words(e, t('error.todo', { title: todoWords(item).title }));
            }),
            undo: () =>
              run.undo().catch((e) => {
                throw words(e, t('error.todoUndo', { title: todoWords(item).title }));
              }),
          };
        } catch (e) {
          throw e instanceof TodoActionError ? e : words(e, t('error.todo', { title: todoWords(item).title }));
        }
      },
      async restoreContact(contact) {
        const { id } = need();
        await restoreContact(db, id, contact).catch((e) => {
          throw words(e, t('error.restoreContact'));
        });
      },
    };
  }, [householdId, email, profiles, user, ready, layout]);

  return { state, actions };
}
