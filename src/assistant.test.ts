import { describe, expect, test } from 'bun:test';
import type { User } from 'firebase/auth';
import { parseConnectParams, pkceChallenge } from '@huishouden/pwa-kit/signin-handoff';
import { cliPort, connectAllowed, declineUrl, geminiSettings, handOff, mcpUrl, serviceAllowed } from './assistant';

const CONNECTOR = 'https://huishouden-connector.example.workers.dev';

describe('the assistant connector', () => {
  test('the address people paste ends in /mcp', () => {
    expect(mcpUrl(CONNECTOR)).toBe(`${CONNECTOR}/mcp`);
    expect(mcpUrl('')).toBe('');
  });

  test("Gemini CLI's settings use httpUrl", () => {
    expect(JSON.parse(geminiSettings(`${CONNECTOR}/mcp`))).toEqual({ mcpServers: { huishouden: { httpUrl: `${CONNECTOR}/mcp` } } });
  });

  test('the portal hands a sign-in only to the connector it knows', () => {
    expect(serviceAllowed(CONNECTOR, [CONNECTOR])).toBe(true);
    expect(serviceAllowed(`${CONNECTOR}/anything`, [CONNECTOR])).toBe(true);
    expect(serviceAllowed('https://huishouden-connector.evil.workers.dev', [CONNECTOR])).toBe(false);
    expect(serviceAllowed('not a url', [CONNECTOR])).toBe(false);
    expect(serviceAllowed(CONNECTOR, [])).toBe(false);
  });

  test('declining goes back through the connector, without a code', () => {
    expect(declineUrl({ service: CONNECTOR, state: 'state-0123456789abcdef', client: 'Claude' })).toBe(`${CONNECTOR}/connect/callback?state=state-0123456789abcdef`);
  });
});

describe('signing in the hh command line', () => {
  const STATE = 'state-0123456789abcdef';
  const REDIRECT = 'http://127.0.0.1:49152/callback';
  const cliParams = async (redirect = REDIRECT) => {
    const challenge = await pkceChallenge('v'.repeat(43));
    return parseConnectParams(`?${new URLSearchParams({ service: 'hh', redirect, state: STATE, code_challenge: challenge })}`);
  };

  test('only an exact loopback address, and only when this build knows the connector', async () => {
    const params = (await cliParams())!;
    expect(connectAllowed(params, CONNECTOR)).toBe(true);
    expect(connectAllowed(params, '')).toBe(false);
    expect(cliPort(params)).toBe('49152');
    for (const bad of ['http://localhost:49152/callback', 'https://evil.example/callback', 'http://127.0.0.1:49152/elsewhere']) expect(await cliParams(bad)).toBeNull();
    // A connector-style request naming hh's address is not a command-line sign-in.
    expect(connectAllowed({ service: REDIRECT, state: STATE, client: 'hh' }, CONNECTOR)).toBe(false);
  });

  test("the refresh token goes to the connector's /cli/hand-off; hh gets only a one-time code at its own address", async () => {
    const params = (await cliParams())!;
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ code: 'code-0123456789abcdefghij' }), { status: 200 });
    }) as unknown as typeof fetch;
    const next = await handOff(params, { refreshToken: 'refresh-token-secret' } as User, fetchImpl, CONNECTOR);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${CONNECTOR}/cli/hand-off`);
    expect(calls[0].body).toMatchObject({ state: STATE, refreshToken: 'refresh-token-secret', codeChallenge: params.codeChallenge, redirect: REDIRECT });
    expect(next).toBe(`${REDIRECT}?state=${STATE}&code=code-0123456789abcdefghij`);
    expect(next).not.toContain('refresh-token-secret');
  });

  test('declining tells hh at its own address', async () => {
    expect(declineUrl((await cliParams())!)).toBe(`${REDIRECT}?state=${STATE}&error=access_denied`);
  });
});
