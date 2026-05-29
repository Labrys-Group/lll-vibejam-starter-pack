// Token fetch: the browser's "can I get a room-join token, and what happens
// when I can't" seam for the LiveKit voice session. This is a pure I/O helper
// with no dependency on `livekit-client`, Three.js, or the render loop, so it
// can be unit-tested headlessly with no microphone, audio, or live room.
//
// We do NOT mint tokens. An external token server (run by the brain team) mints
// room-join JWTs and is reached over a public tunnel URL:
//
//   GET <VITE_TOKEN_ENDPOINT>/token?room=<name>
//     -> 200 { "token": "<JWT>", "url": "wss://<project>.livekit.cloud" }
//
// `fetchToken` NEVER throws — every failure (missing env, network error,
// non-2xx, malformed body) is reported as a typed "unavailable" outcome so the
// HUD (02b) can decide whether Connect is enabled without a try/catch. The
// returned `{ token, url }` maps directly onto `room.connect(url, token)`.

/** Credentials needed to join a LiveKit room — consumed by `room.connect(url, token)`. */
export interface TokenGrant {
  token: string;
  url: string;
}

/** Why a token could not be obtained — stable enough to branch/log/surface on. */
export type TokenUnavailableReason =
  | 'no_endpoint' // VITE_TOKEN_ENDPOINT unset/blank — fetch not attempted
  | 'network_error' // fetch rejected (offline, DNS, CORS)
  | 'bad_status' // response was not ok (non-2xx)
  | 'malformed_body'; // not JSON, or missing/wrong-typed token|url

/** Result of {@link fetchToken}: a grant, or a typed reason it was unavailable. */
export type TokenResult =
  | ({ ok: true } & TokenGrant)
  | { ok: false; reason: TokenUnavailableReason; message: string };

function unavailable(reason: TokenUnavailableReason, message: string): TokenResult {
  return { ok: false, reason, message };
}

/**
 * Fetch a room-join token from the external token server.
 *
 * @param room  the room name to join (URL-encoded into the query string).
 * @returns a {@link TokenResult} — `{ ok: true, token, url }` on success, or a
 *          typed unavailable outcome on any failure. Never throws.
 */
export async function fetchToken(room: string): Promise<TokenResult> {
  const endpoint = import.meta.env.VITE_TOKEN_ENDPOINT?.trim();
  if (!endpoint) {
    return unavailable('no_endpoint', 'VITE_TOKEN_ENDPOINT is not set; cannot fetch a token.');
  }

  const url = `${endpoint.replace(/\/+$/, '')}/token?room=${encodeURIComponent(room)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    return unavailable('network_error', `Token request failed: ${String(cause)}`);
  }

  if (!response.ok) {
    return unavailable('bad_status', `Token server returned HTTP ${response.status}.`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return unavailable('malformed_body', 'Token response was not valid JSON.');
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).token !== 'string' ||
    typeof (body as Record<string, unknown>).url !== 'string'
  ) {
    return unavailable('malformed_body', 'Token response is missing a string token/url.');
  }

  const { token, url: joinUrl } = body as { token: string; url: string };
  return { ok: true, token, url: joinUrl };
}
