import { collection, doc, onSnapshot, query, where, type Firestore, type Unsubscribe } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { deleteDoc, setDoc } from '@huishouden/pwa-kit/firestore';
import { CALLBACK_PATH, CLI_HANDOFF_PATH, CLI_SERVICE, HANDOFF_PATH, isLoopbackRedirect, isPkceChallenge, type CliHandoffRequest, type ConnectParams, type HandoffRequest } from '@huishouden/pwa-kit/signin-handoff';
import { getLang } from '@huishouden/pwa-kit/i18n';

/**
 * Using Huishouden from an AI assistant (huishouden/connector, a remote MCP server):
 * the connector's address, the portal's half of its sign-in (`/connect`), and the person's
 * connected assistants with their activity (`households/{id}/connections`, only theirs).
 */

/** The connector for this build (production or staging), from the VITE_CONNECTOR_URL repo variable. */
export const CONNECTOR_URL = (import.meta.env.VITE_CONNECTOR_URL ?? '').replace(/\/$/, '');

/** What people paste into their assistant. */
export const mcpUrl = (base = CONNECTOR_URL) => (base ? `${base}/mcp` : '');

/** Gemini CLI's ~/.gemini/settings.json entry for the connector. */
export const geminiSettings = (url: string) => JSON.stringify({ mcpServers: { huishouden: { httpUrl: url } } }, null, 2);

/**
 * Whether the portal may hand a signed-in person to `service`: only the connector this build
 * knows, never an address taken from the link alone.
 */
export function serviceAllowed(service: string, allowed: readonly string[] = CONNECTOR_URL ? [CONNECTOR_URL] : []): boolean {
  try {
    const origin = new URL(service).origin;
    return allowed.some((a) => new URL(a).origin === origin);
  } catch {
    return false;
  }
}

/** The `hh` command line's sign-in: the portal hands it over through the connector (`/cli/hand-off`). */
export const isCliSignIn = (params: ConnectParams): boolean => params.service === CLI_SERVICE && params.purpose === 'cli';

/**
 * Whether the portal may hand this sign-in over at all: to the connector this build knows, or to
 * `hh` on this computer, only at an exact loopback address with a PKCE challenge, and only when this
 * build knows the connector that keeps the hand-off.
 */
export function connectAllowed(params: ConnectParams, connector: string = CONNECTOR_URL): boolean {
  if (isCliSignIn(params)) return !!connector && isLoopbackRedirect(params.redirect ?? '') && isPkceChallenge(params.codeChallenge);
  return serviceAllowed(params.service, connector ? [connector] : []);
}

/** A hand-off that hasn't answered by then has failed: the page says so and Allow works again. */
const HANDOFF_TIMEOUT_MS = 20_000;

/** The port `hh` listens on, shown on the confirmation. */
export const cliPort = (params: ConnectParams): string => (params.redirect ? new URL(params.redirect).port : '');

const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

/**
 * The person's language and time zone in their profile, so the assistant answers their way.
 * Merged, so the name and photo stay.
 */
export async function saveLangAndZone(db: Firestore, householdId: string, email: string): Promise<void> {
  const zone = timeZone();
  await setDoc(
    // The profile document is the member's own (rules: only they write it).
    doc(db, 'households', householdId, 'profiles', email),
    { lang: getLang(), ...(zone ? { timeZone: zone } : {}), updatedAt: Date.now() },
    { merge: true },
  );
}

/**
 * Hands the signed-in person to the connector: posts their refresh token for this sign-in's state,
 * then returns where the browser goes next (the connector's callback, which finishes the sign-in
 * and sends them back to their assistant).
 */
export async function handOff(params: ConnectParams, user: User, fetchImpl: typeof fetch = fetch, connector: string = CONNECTOR_URL): Promise<string> {
  // Checked here too, not only by the page: nothing is posted anywhere this build doesn't know.
  if (!connectAllowed(params, connector)) throw new Error('hand-off refused');
  const signal = AbortSignal.timeout(HANDOFF_TIMEOUT_MS);
  if (isCliSignIn(params)) {
    // The connector keeps it under a one-time code bound to hh's challenge; only the code goes to hh.
    const cli: CliHandoffRequest = { state: params.state, refreshToken: user.refreshToken, codeChallenge: params.codeChallenge!, redirect: params.redirect!, lang: getLang(), ...(timeZone() ? { timeZone: timeZone() } : {}) };
    const res = await fetchImpl(`${connector}${CLI_HANDOFF_PATH}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cli), signal });
    if (!res.ok) throw new Error(`hand-off ${res.status}`);
    const { code } = (await res.json()) as { code: string };
    return `${params.redirect}?state=${encodeURIComponent(params.state)}&code=${encodeURIComponent(code)}`;
  }
  const body: HandoffRequest = { state: params.state, refreshToken: user.refreshToken, lang: getLang(), ...(timeZone() ? { timeZone: timeZone() } : {}) };
  const res = await fetchImpl(`${new URL(connector).origin}${HANDOFF_PATH}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error(`hand-off ${res.status}`);
  const { code } = (await res.json()) as { code: string };
  return `${new URL(connector).origin}${CALLBACK_PATH}?state=${encodeURIComponent(params.state)}&code=${encodeURIComponent(code)}`;
}

/** Declining: the connector's callback without a code tells the assistant the person said no; `hh` hears `error=access_denied`. */
export const declineUrl = (params: ConnectParams) =>
  isCliSignIn(params) ? `${params.redirect}?state=${encodeURIComponent(params.state)}&error=access_denied` : `${params.service}${CALLBACK_PATH}?state=${encodeURIComponent(params.state)}`;

export interface Connection {
  id: string;
  client: string;
  clientUri?: string;
  createdAt: number;
  lastUsedAt?: number;
}

export interface AuditEntry {
  id: string;
  tool: string;
  kind: 'read' | 'write';
  ok: boolean;
  app?: string;
  at: number;
}

const toConnection = (id: string, d: Record<string, unknown>): Connection => ({
  id,
  client: typeof d.client === 'string' ? d.client : '',
  ...(typeof d.clientUri === 'string' ? { clientUri: d.clientUri } : {}),
  createdAt: typeof d.createdAt === 'number' ? d.createdAt : 0,
  ...(typeof d.lastUsedAt === 'number' ? { lastUsedAt: d.lastUsedAt } : {}),
});

/** The person's own connected assistants in this household, most recently used first. */
export function watchConnections(db: Firestore, householdId: string, me: string, onChange: (list: Connection[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'households', householdId, 'connections'), where('email', '==', me)),
    (snap) => onChange(snap.docs.map((d) => toConnection(d.id, d.data())).sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt))),
    onError,
  );
}

/** What an assistant did lately (newest first, at most `limit`). */
export function watchAudit(db: Firestore, householdId: string, connectionId: string, onChange: (list: AuditEntry[]) => void, limit = 20): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'connections', connectionId, 'audit'),
    (snap) =>
      onChange(
        snap.docs
          .map((d) => {
            const x = d.data();
            return { id: d.id, tool: String(x.tool ?? ''), kind: x.kind === 'write' ? ('write' as const) : ('read' as const), ok: x.ok === true, ...(typeof x.app === 'string' ? { app: x.app } : {}), at: Number(x.at ?? 0) };
          })
          .sort((a, b) => b.at - a.at)
          .slice(0, limit),
      ),
    () => onChange([]),
  );
}

/** Ends the assistant's access at the connector, then removes the person's record of it here. */
export async function revoke(db: Firestore, householdId: string, connection: Connection, user: User, fetchImpl: typeof fetch = fetch): Promise<void> {
  const idToken = await user.getIdToken();
  const res = await fetchImpl(`${CONNECTOR_URL}/connections/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionId: connection.id }),
  });
  if (!res.ok) throw new Error(`revoke ${res.status}`);
  await deleteDoc(doc(db, 'households', householdId, 'connections', connection.id)).catch(() => {});
}
