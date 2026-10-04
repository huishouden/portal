import { describe, expect, test } from 'bun:test';
import { declineUrl, geminiSettings, mcpUrl, serviceAllowed } from './assistant';

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
