import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { cardClass, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { CLI_SERVICE, parseConnectParams } from '@huishouden/pwa-kit/signin-handoff';
import { cliPort, connectAllowed, declineUrl, handOff, isCliSignIn, saveLangAndZone } from '../assistant';
import { auth, db } from '../firebase';
import { useT } from '../i18n';

/**
 * The portal's half of connecting an AI assistant (huishouden/connector) or signing in the `hh`
 * command line: the person signs in here as in every app, sees who is asking and where access goes,
 * and on Allow the portal hands the connector their sign-in and sends them back to their assistant,
 * or to `hh` on this computer with a one-time code. Only the connector this build knows is ever
 * handed anything, and `hh` only at an exact loopback address.
 */
export function ConnectScreen({ user, householdId, onSignIn, signingIn }: { user: User | null | undefined; householdId?: string; onSignIn: () => void; signingIn: boolean }) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const allowButton = useRef<HTMLButtonElement>(null);
  const params = useMemo(() => parseConnectParams(location.search), []);
  const cliAsked = useMemo(() => new URLSearchParams(location.search).get('service') === CLI_SERVICE, []);
  const allowed = params !== null && connectAllowed(params);
  const cli = allowed && isCliSignIn(params!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const title = !allowed ? t('connect.invalidTitle') : cli ? t('connect.cliTitle') : t('connect.title', { client: params!.client });

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
      // Back where they were, so a keyboard or screen reader user can try again at once.
      requestAnimationFrame(() => allowButton.current?.focus());
    }
  };

  return (
    <article className={`${cardClass} mx-auto max-w-[560px] space-y-4 p-6 text-base leading-relaxed text-ink sm:p-8`}>
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold text-ink outline-none">
        {title}
      </h1>
      {!allowed ? (
        <p>{cliAsked ? t('connect.cliInvalid') : t('connect.invalid')}</p>
      ) : user === undefined ? null : !user ? (
        <>
          <p>{cli ? t('connect.cliSignInFirst') : t('connect.signInFirst', { client: params!.client })}</p>
          <button type="button" className={primaryButton} disabled={signingIn} onClick={onSignIn}>
            {t('connect.signIn')}
          </button>
        </>
      ) : (
        <>
          <p>{t('connect.asYou', { client: params!.client, email: user.email ?? '' })}</p>
          <p>{cli ? t('connect.cliWhat') : t('connect.what')}</p>
          {cli ? (
            <p className="border-l-4 border-attention-fill pl-3 font-medium">{t('connect.cliOnlyIf', { port: cliPort(params!) })}</p>
          ) : (
            params!.redirectHost && <p className="font-medium">{t('connect.host', { host: params!.redirectHost })}</p>
          )}
          <p className="text-muted">{cli ? t('connect.cliRevokeLater') : t('connect.revokeLater')}</p>
          <p role="status" className="sr-only">
            {busy ? t('connect.connecting') : ''}
          </p>
          {error && (
            <p role="alert" className="text-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <button ref={allowButton} type="button" className={primaryButton} aria-disabled={busy} onClick={() => !busy && void allow()}>
              {busy ? t('connect.connecting') : t('connect.allow')}
            </button>
            <button type="button" className={secondaryButton} aria-disabled={busy} onClick={() => !busy && location.assign(declineUrl(params!))}>
              {t('connect.decline')}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
