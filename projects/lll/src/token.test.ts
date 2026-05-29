import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchToken, type TokenResult } from './token.ts';

// `fetchToken` reads `import.meta.env.VITE_TOKEN_ENDPOINT` and calls the global
// `fetch`. Both are stubbed per-test and reset afterwards so cases stay isolated.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** A `Response`-like stub good enough for `fetchToken` (it only reads `ok`/`json`). */
function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

/** Narrow to the success arm so a failed fetch can't silently pass a grant assertion. */
function expectOk(result: TokenResult): { token: string; url: string } {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`expected ok, got unavailable: ${result.reason}`);
  return { token: result.token, url: result.url };
}

describe('fetchToken — success', () => {
  it('returns the token and url from a 200 with a valid body', async () => {
    vi.stubEnv('VITE_TOKEN_ENDPOINT', 'https://tokens.example');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ token: 'jwt-123', url: 'wss://p.livekit.cloud' })),
    );

    const grant = expectOk(await fetchToken('arena'));
    expect(grant).toEqual({ token: 'jwt-123', url: 'wss://p.livekit.cloud' });
  });

  it('calls <endpoint>/token?room=<encoded>, tolerating a trailing slash', async () => {
    vi.stubEnv('VITE_TOKEN_ENDPOINT', 'https://tokens.example/');
    const fetchSpy = vi.fn(async () => jsonResponse({ token: 't', url: 'wss://x' }));
    vi.stubGlobal('fetch', fetchSpy);

    await fetchToken('blue room');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('https://tokens.example/token?room=blue%20room');
  });
});

describe('fetchToken — graceful degrade (never throws)', () => {
  it('reports no_endpoint and does not call fetch when the env var is unset', async () => {
    vi.stubEnv('VITE_TOKEN_ENDPOINT', '');
    const fetchSpy = vi.fn(async () => jsonResponse({ token: 't', url: 'wss://x' }));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchToken('arena');

    expect(result).toMatchObject({ ok: false, reason: 'no_endpoint' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports network_error when fetch rejects', async () => {
    vi.stubEnv('VITE_TOKEN_ENDPOINT', 'https://tokens.example');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const result = await fetchToken('arena');
    expect(result).toMatchObject({ ok: false, reason: 'network_error' });
  });

  it('reports bad_status on a non-2xx response', async () => {
    vi.stubEnv('VITE_TOKEN_ENDPOINT', 'https://tokens.example');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response),
    );

    const result = await fetchToken('arena');
    expect(result).toMatchObject({ ok: false, reason: 'bad_status' });
  });

  it('reports malformed_body when the response is not JSON', async () => {
    vi.stubEnv('VITE_TOKEN_ENDPOINT', 'https://tokens.example');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            json: async () => {
              throw new SyntaxError('Unexpected token <');
            },
          }) as unknown as Response,
      ),
    );

    const result = await fetchToken('arena');
    expect(result).toMatchObject({ ok: false, reason: 'malformed_body' });
  });

  it('reports malformed_body when token/url are missing or wrong-typed', async () => {
    vi.stubEnv('VITE_TOKEN_ENDPOINT', 'https://tokens.example');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ token: 42, url: null })));

    const result = await fetchToken('arena');
    expect(result).toMatchObject({ ok: false, reason: 'malformed_body' });
  });
});
