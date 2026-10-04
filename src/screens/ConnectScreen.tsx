import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { cardClass, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { parseConnectParams } from '@huishouden/pwa-kit/signin-handoff';
import { declineUrl, handOff, saveLangAndZone, serviceAllowed } from '../assistant';
import { auth, db } from '../firebase';
import { useT } from '../i18n';

/**
 * The portal's half of connecting an AI assistant (huishouden/connector): the person signs in here
 * as in every app, sees who is asking and where access goes, and on Allow the portal hands the
 * connector their sign-in and sends them back to their assistant. Only the connector this build
 * knows is ever handed anything.
 */
export function ConnectScreen({ user, householdId, onSignIn, signingIn }: { user: User | null | undefined; householdId?: string; onSignIn: () => void; signingIn: boolean }) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const params = useMemo(() => parseConnectParams(location.search), []);
  const allowed = params !== null && serviceAllowed(params.service);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const title = allowed ? t('connect.title', { client: params!.client }) : t('connect.invalidTitle');

  useEffect(() => {
    const before = document.title;
    document.title = title;
    heading.current?.focus();
    return () => {
      document.title = before;
    };
  }, [title]);

  const allow = async () => {
    const current = auth.currentUser;
    if (!params || !current?.email) return;
    setBusy(true);
    setError(undefined);
    try {
      if (householdId) await saveLangAndZone(db, householdId, current.email.toLowerCase()).catch(() => {});
      location.assign(await handOff(params, current));
    } catch {
      setError(t('connect.failed'));
      setBusy(false);
    }
  };

  return (
    <article className={`${cardClass} mx-auto max-w-[560px] space-y-4 p-6 text-base leading-relaxed text-ink sm:p-8`}>
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold text-ink outline-none">
        {title}
      </h1>
      {!allowed ? (
        <p>{t('connect.invalid')}</p>
      ) : user === undefined ? null : !user ? (
        <>
          <p>{t('connect.signInFirst', { client: params!.client })}</p>
          <button type="button" className={primaryButton} disabled={signingIn} onClick={onSignIn}>
            {t('connect.signIn')}
          </button>
        </>
      ) : (
        <>
          <p>{t('connect.asYou', { client: params!.client, email: user.email ?? '' })}</p>
          <p>{t('connect.what')}</p>
          {params!.redirectHost && <p className="font-medium">{t('connect.host', { host: params!.redirectHost })}</p>}
          <p className="text-muted">{t('connect.revokeLater')}</p>
          {error && (
            <p role="alert" className="text-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" className={primaryButton} disabled={busy} onClick={() => void allow()}>
              {busy ? t('connect.connecting') : t('connect.allow')}
            </button>
            <button type="button" className={secondaryButton} disabled={busy} onClick={() => location.assign(declineUrl(params!))}>
              {t('connect.decline')}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
