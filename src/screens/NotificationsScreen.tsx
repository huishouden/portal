import { useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { AppNotificationToggles, DeviceNotifications } from '@huishouden/pwa-kit/react/push';
import type { Role } from '@huishouden/pwa-kit/roles';
import { cardClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import type { HouseholdApp } from '../apps';
import { notifyingApps } from '../notify';
import { db } from '../firebase';
import { useT } from '../i18n';

/** The VAPID key the shared sender signs with; without it the page says notifications are not set up. */
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

interface Props {
  /** undefined while sign-in restores; null signed out. */
  user: User | null | undefined;
  householdId?: string;
  me?: string;
  role: Role | null;
  /** Every app in the household's order. */
  apps: HouseholdApp[];
  onSignIn: () => void;
}

/**
 * Notifications (account menu, and each app's "Manage in Huishouden"): this device on or off for
 * the whole suite with a test notification, and which apps remind the signed-in person.
 */
export function NotificationsScreen({ user, householdId, me, role, apps, onSignIn }: Props) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const title = t('notifications.title');
  useEffect(() => {
    const before = document.title;
    document.title = title;
    heading.current?.focus();
    return () => {
      document.title = before;
    };
  }, [title]);

  const offered = notifyingApps(apps, role);
  return (
    <article className={`${cardClass} mx-auto max-w-[720px] space-y-6 p-6 text-base leading-relaxed text-ink sm:p-8`}>
      <header className="space-y-2">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold text-ink outline-none">
          {title}
        </h1>
        <p className="text-muted">{t('notifications.intro')}</p>
      </header>
      {user === null ? (
        <div className="space-y-3">
          <p>{t('notifications.signIn')}</p>
          <button type="button" className={primaryButton} onClick={onSignIn}>
            {t('connect.signIn')}
          </button>
        </div>
      ) : user && householdId && me ? (
        <>
          <DeviceNotifications db={db} householdId={householdId} user={{ email: me }} vapidKey={VAPID_PUBLIC_KEY} plain labels={Object.fromEntries(apps.map((a) => [a.repo, a.name]))} />
          <AppNotificationToggles db={db} householdId={householdId} email={me} apps={offered.map((a) => ({ id: a.repo, label: a.name }))} plain />
        </>
      ) : user ? (
        <p className="text-muted">{t('notifications.noHousehold')}</p>
      ) : null}
    </article>
  );
}
