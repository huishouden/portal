import { CalendarDays, Contact as ContactIcon, LayoutGrid, ListChecks, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { AppBar } from '@huishouden/pwa-kit/react/app-bar';
import { SectionTabs, Toast, useToast, type Tab } from '@huishouden/pwa-kit/react/ui';
import { APPS, arrangeTiles, type PortalLayout } from './apps';
import { AGENDA_DAYS, AGENDA_WEEK_DAYS, useLiveHub } from './data/live';
import { usePreview } from './data/preview';
import { can, MONEY_APPS } from '@huishouden/pwa-kit/roles';
import { isMember, myRole, type HubState } from './hub';
import { restoringMember } from './memberHint';
import { AppsScreen } from './screens/AppsScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { ContactsScreen } from './screens/ContactsScreen';
import { clearSharedContact, readSharedContact, type ParsedContact } from '@huishouden/pwa-kit/contacts';
import { TodayScreen } from './screens/TodayScreen';
import { TodoScreen } from './screens/TodoScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { ASSISTANT_PATH, CALENDAR_SETTINGS_PATH, PRIVACY_PATH } from '@huishouden/pwa-kit/app-bar';
import { CONNECT_PATH } from '@huishouden/pwa-kit/signin-handoff';
import { AssistantScreen } from './screens/AssistantScreen';
import { ConnectScreen } from './screens/ConnectScreen';
import { MyCalendarScreen } from './screens/MyCalendarScreen';
import { auth } from './firebase';
import { trackView } from '@huishouden/pwa-kit/observability';
import { useNow } from './now';
import { t, useT } from './i18n';

const VERSION = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_BUILD_SHA})`;

type TabId = 'today' | 'todo' | 'calendar' | 'contacts' | 'apps';
const TAB_IDS: TabId[] = ['today', 'todo', 'calendar', 'contacts', 'apps'];

/**
 * Members get the tabs; everyone else sees Apps (signed out, with what Huishouden is). A device that
 * remembers a member gets them while sign-in restores, so a reload doesn't flash the introduction.
 * On phones the bottom bar holds four, led by what needs doing (Today, To-do), then Calendar and
 * Apps; Contacts is under More.
 */
function tabsFor(state: HubState): Tab[] {
  if (!isMember(state) && !restoringMember(state)) return [];
  return [
    { id: 'today', label: t('tabs.today'), icon: Sun, primary: true },
    { id: 'todo', label: t('tabs.todo'), icon: ListChecks, primary: true },
    { id: 'calendar', label: t('tabs.calendar'), icon: CalendarDays, primary: true },
    { id: 'contacts', label: t('tabs.contacts'), icon: ContactIcon },
    { id: 'apps', label: t('tabs.apps'), icon: LayoutGrid, primary: true },
  ];
}

/** Pages outside the tabs: Privacy, the household in the person's own calendar, and using Huishouden from an AI assistant (its page and its sign-in). */
type Page = 'privacy' | 'assistant' | 'connect' | 'my-calendar';
const PAGES: Record<string, Page> = { [PRIVACY_PATH]: 'privacy', [ASSISTANT_PATH]: 'assistant', [CONNECT_PATH]: 'connect', [CALENDAR_SETTINGS_PATH]: 'my-calendar' };
const pageFromPath = (): Page | null => PAGES[location.pathname.replace(/\/$/, '')] ?? null;

const tabFromPath = (): TabId | undefined => {
  const id = location.pathname.replace(/^\/|\/$/g, '');
  return TAB_IDS.find((t) => t === id);
};

export default function App() {
  const t = useT();
  const [chosen, setChosen] = useState<TabId | undefined>(tabFromPath);
  // The whole published agenda only while the Calendar tab is chosen (a page opened over it keeps
  // it); a week otherwise (Today, Apps).
  const live = useLiveHub(chosen === 'calendar' ? AGENDA_DAYS : AGENDA_WEEK_DAYS);
  const preview = usePreview();
  const { state, actions } = preview ?? live;
  const { toast, notify, fail, clear } = useToast();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string>();
  const [page, setPage] = useState<Page | null>(pageFromPath);
  // Privacy and the assistant pages replace the tabs' content.
  const onPage = page !== null;
  // A contact card from the Share menu (Contacts → Share → Huishouden): kept until a member's
  // Contacts tab can open it as a new contact, filled in.
  const [sharedCards, setSharedCards] = useState<ParsedContact[] | null>(null);
  const now = useNow();
  const hour = new Date(now).getHours();

  // Members land on Today (the wall tablet's view); everyone else on Apps.
  const tabs = tabsFor(state);
  const tab: TabId = tabs.some((t) => t.id === chosen) ? chosen! : tabs.length ? 'today' : 'apps';

  // Someone who just started a household stays on Apps, where they invite the others.
  const householdStatus = state.auth === 'signed-in' ? state.household.status : undefined;
  const [lastStatus, setLastStatus] = useState(householdStatus);
  if (householdStatus !== lastStatus) {
    setLastStatus(householdStatus);
    if (lastStatus === 'none' && householdStatus === 'ready' && !chosen) setChosen('apps');
  }

  useEffect(() => {
    void readSharedContact().then((cards) => {
      if (!cards) return;
      clearSharedContact();
      setSharedCards(cards);
      setChosen('contacts');
    });
  }, []);

  useEffect(() => {
    const onPop = () => {
      setChosen(tabFromPath());
      setPage(pageFromPath());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const shown = page ?? tab;
  useEffect(() => {
    trackView(shown);
  }, [shown]);

  // Apps link here to set something in the Household panel (`/apps#household`, e.g. the home
  // address, or `#household-members`, `-home`, `-currency` for one section, which a phone opens):
  // once the household has loaded on the Apps tab, bring the panel into view, once.
  const [anchored, setAnchored] = useState(false);
  useEffect(() => {
    if (anchored || shown !== 'apps' || householdStatus !== 'ready' || !location.hash.startsWith('#household')) return;
    setAnchored(true);
    document.getElementById('household')?.scrollIntoView({ block: 'start' });
  }, [anchored, shown, householdStatus]);

  const choose = (id: string) => {
    setChosen(id as TabId);
    setPage(null);
    history.pushState(null, '', `/${id}`);
    window.scrollTo(0, 0);
  };

  const openPage = (path: string, next: Page) => {
    history.pushState(null, '', path);
    setPage(next);
    window.scrollTo(0, 0);
  };

  const signIn = useCallback(async () => {
    setSigningIn(true);
    setSignInError(undefined);
    try {
      await actions.signIn();
    } catch (e) {
      setSignInError(e instanceof Error ? e.message : String(e));
    } finally {
      setSigningIn(false);
    }
  }, [actions]);

  const saveLayout = useCallback(
    (layout: PortalLayout, previous: PortalLayout) => {
      const save = (next: PortalLayout) => actions.saveLayout(next).catch((e) => fail(e instanceof Error ? e.message : String(e)));
      void save(layout);
      notify(t('toast.layoutSaved'), () => void save(previous));
    },
    [actions, notify, fail, t],
  );

  const user = state.auth === 'starting' ? undefined : state.auth === 'signed-out' ? null : state.user;
  const role = myRole(state);
  // Helpers and kids don't see Spending or Bills anywhere in the hub.
  const visibleApps = isMember(state) && !can(role, 'see-money') ? APPS.filter((a) => !MONEY_APPS.includes(a.repo)) : APPS;
  const ordered = arrangeTiles(visibleApps, state.layout).all;
  const signedIn = state.auth === 'signed-in' ? state : undefined;
  // A preview (screenshots, smoke tests) has no Firebase user; calls it makes go nowhere real.
  const previewUser = preview ? ({ getIdToken: async () => 'preview', refreshToken: 'preview' } as unknown as User) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-page font-sans text-ink antialiased">
      {/* i18n-ignore: the suite's name, never translated */}
      <AppBar app="Huishouden" glyph="home" portalUrl="/" version={VERSION} user={user} signingIn={signingIn} onSignIn={signIn} onSignOut={() => void actions.signOut()}>
        <SectionTabs tabs={tabs} tab={onPage ? '' : tab} onTab={choose} />
      </AppBar>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">
        {page === 'privacy' && <PrivacyScreen />}
        {page === 'assistant' && (
          <AssistantScreen
            user={state.auth === 'starting' ? undefined : signedIn ? auth.currentUser : null}
            householdId={signedIn?.household.status === 'ready' ? signedIn.household.id : undefined}
            me={signedIn?.me}
            notify={notify}
            fail={fail}
          />
        )}
        {page === 'my-calendar' && (
          <MyCalendarScreen
            user={state.auth === 'starting' ? undefined : signedIn ? (auth.currentUser ?? previewUser) : null}
            householdId={signedIn?.household.status === 'ready' ? signedIn.household.id : undefined}
            me={signedIn?.me}
            role={role}
            apps={ordered}
            notify={notify}
            fail={fail}
          />
        )}
        {page === 'connect' && (
          <ConnectScreen
            user={state.auth === 'starting' ? undefined : signedIn ? auth.currentUser : null}
            householdId={signedIn?.household.status === 'ready' ? signedIn.household.id : undefined}
            onSignIn={() => void signIn()}
            signingIn={signingIn}
          />
        )}
        {!onPage && tab === 'apps' && (
          <AppsScreen
            state={state}
            actions={actions}
            apps={visibleApps}
            hour={hour}
            now={now}
            onOpenPage={(path) => PAGES[path] && openPage(path, PAGES[path])}
            signInError={signInError}
            onSignIn={signIn}
            onSaveLayout={saveLayout}
            notify={notify}
            fail={fail}
          />
        )}
        {!onPage && tab === 'today' && (
          <TodayScreen
            agenda={signedIn?.agenda}
            apps={ordered}
            now={now}
            me={signedIn?.me}
            profiles={signedIn?.household.status === 'ready' ? signedIn.household.profiles : undefined}
          />
        )}
        {!onPage && tab === 'todo' && (
          <TodoScreen todos={signedIn?.todos} apps={ordered} now={now} me={signedIn?.me} role={role} actions={actions} notify={notify} fail={fail} />
        )}
        {!onPage && tab === 'calendar' && <CalendarScreen agenda={signedIn?.agenda} apps={ordered} now={now} onOwnCalendar={signedIn ? () => openPage(CALENDAR_SETTINGS_PATH, 'my-calendar') : undefined} />}
        {!onPage && tab === 'contacts' && (
          <ContactsScreen
            contacts={signedIn?.contacts}
            apps={ordered}
            actions={actions}
            notify={notify}
            fail={fail}
            me={signedIn?.me}
            role={role}
            shared={sharedCards}
            onSharedOpened={() => setSharedCards(null)}
          />
        )}
      </main>
      <footer className="mx-auto w-full max-w-[1200px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-muted sm:px-6">
        <a
          className="inline-flex min-h-11 items-center font-medium text-link underline-offset-4 hover:underline"
          href={PRIVACY_PATH}
          onClick={(e) => {
            e.preventDefault();
            history.pushState(null, '', PRIVACY_PATH);
            setPage('privacy');
            window.scrollTo(0, 0);
          }}
        >
          {t('privacy.link')}
        </a>
      </footer>
      <Toast toast={toast} onDone={clear} />
    </div>
  );
}
