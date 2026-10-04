import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { cardClass, ghostButton, linkClass, overline, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { formatAgo } from '@huishouden/pwa-kit/time';
import { geminiSettings, mcpUrl, revoke, saveLangAndZone, watchAudit, watchConnections, type AuditEntry, type Connection } from '../assistant';
import { auth, db } from '../firebase';
import { useT } from '../i18n';
import { CopyField } from '../components/CopyField';

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Activity({ householdId, connection }: { householdId: string; connection: Connection }) {
  const t = useT();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  useEffect(() => watchAudit(db, householdId, connection.id, setEntries), [householdId, connection.id]);
  if (!entries) return null;
  if (!entries.length) return <p className="text-sm text-muted">{t('assistant.noActivity')}</p>;
  const now = Date.now();
  return (
    <ul className="space-y-1 text-sm text-muted">
      {entries.map((e) => (
        <li key={e.id}>
          {/* i18n-ignore: the tool's own name, as the assistant calls it */}
          <span className="font-mono text-ink">{e.tool}</span> · {t(e.kind === 'write' ? 'assistant.changed' : 'assistant.read')}
          {e.ok ? '' : ` · ${t('assistant.refused')}`} · {formatAgo(e.at, now)}
        </li>
      ))}
    </ul>
  );
}

/**
 * "Use Huishouden from your AI assistant": the connector's address to paste, the steps for Claude,
 * ChatGPT and Gemini CLI, and the person's connected assistants with what they did and Revoke.
 * Linked from every app's account menu.
 */
export function AssistantScreen({ user, householdId, me, notify, fail }: { user: User | null | undefined; householdId?: string; me?: string; notify: (message: string) => void; fail: (message: string) => void }) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const title = t('assistant.title');
  const url = mcpUrl();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const before = document.title;
    document.title = title;
    heading.current?.focus();
    return () => {
      document.title = before;
    };
  }, [title]);

  useEffect(() => {
    if (!householdId || !me) return;
    // The assistant answers in this language and counts days in this time zone.
    void saveLangAndZone(db, householdId, me).catch(() => {});
    return watchConnections(db, householdId, me, setConnections, () => setConnections([]));
  }, [householdId, me]);

  const onRevoke = async (c: Connection) => {
    const current = auth.currentUser;
    if (!householdId || !current) return;
    setRevoking(c.id);
    try {
      await revoke(db, householdId, c, current);
      notify(t('assistant.revoked', { client: c.client }));
    } catch {
      fail(t('assistant.revokeFailed'));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <article className={`${cardClass} mx-auto max-w-[720px] space-y-6 p-6 text-base leading-relaxed text-ink sm:p-8`}>
      <header className="space-y-2">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold text-ink outline-none">
          {title}
        </h1>
        <p>{t('assistant.intro')}</p>
        <p className="text-muted">{t('assistant.rules')}</p>
      </header>

      {url ? (
        <section className="space-y-2">
          <h2 className={overline}>{t('assistant.urlTitle')}</h2>
          <CopyField value={url} label={t('assistant.urlTitle')} />
        </section>
      ) : (
        <p className="text-muted">{t('assistant.notAvailable')}</p>
      )}

      {url && (
        <div className="space-y-5">
          <Step title={t('assistant.claudeTitle')}>
            <ol className="list-decimal space-y-1 pl-6">
              <li>{t('assistant.claude1')}</li>
              <li>{t('assistant.claude2')}</li>
              <li>{t('assistant.claude3')}</li>
            </ol>
          </Step>
          <Step title={t('assistant.chatgptTitle')}>
            <ol className="list-decimal space-y-1 pl-6">
              <li>{t('assistant.chatgpt1')}</li>
              <li>{t('assistant.chatgpt2')}</li>
              <li>{t('assistant.chatgpt3')}</li>
            </ol>
          </Step>
          <Step title={t('assistant.geminiTitle')}>
            <p>{t('assistant.gemini1')}</p>
            <CopyField value={geminiSettings(url)} label={t('assistant.geminiTitle')} multiline />
            <p>{t('assistant.gemini2')}</p>
          </Step>
          <Step title={t('assistant.tryTitle')}>
            <p>{t('assistant.try')}</p>
          </Step>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-ink">{t('assistant.connectedTitle')}</h2>
        {!user ? (
          <p className="text-muted">{t('assistant.signIn')}</p>
        ) : connections === null ? null : connections.length === 0 ? (
          <p className="text-muted">{t('assistant.none')}</p>
        ) : (
          <ul className="space-y-3">
            {connections.map((c) => (
              <li key={c.id} className="space-y-2 rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{c.client}</p>
                    <p className="text-sm text-muted">
                      {t('assistant.connectedAgo', { ago: formatAgo(c.createdAt, Date.now()) })}
                      {c.lastUsedAt ? ` · ${t('assistant.usedAgo', { ago: formatAgo(c.lastUsedAt, Date.now()) })}` : ''}
                    </p>
                  </div>
                  <button type="button" className={ghostButton} aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                    {t('assistant.activity')}
                  </button>
                  <button type="button" className={secondaryButton} disabled={revoking === c.id} onClick={() => void onRevoke(c)}>
                    {revoking === c.id ? t('assistant.revoking') : t('assistant.revoke')}
                  </button>
                </div>
                {open === c.id && householdId && <Activity householdId={householdId} connection={c} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted">
        {t('assistant.source')}{' '}
        <a className={linkClass} href="https://github.com/huishouden/connector">
          {t('assistant.sourceLink')}
        </a>
      </p>
    </article>
  );
}
