# 02a — Token fetch (external endpoint) + graceful degrade

Status: ready-for-agent
Type: AFK

## Parent

Issue: `.scratch/voice-agent-integration/issues/02-livekit-voice-session.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

The "can I get a room-join token, and what happens when I can't" slice — the
browser seam plus its degrade behavior — verifiable with no microphone, no
audio, and no live room.

We do **not** mint tokens ourselves. An **external token server** (run by the
brain team) already mints room-join JWTs:

```
GET <endpoint>/token?room=<name>
→ 200 { "token": "<JWT>", "url": "wss://<project>.livekit.cloud" }
```

So there is no server code, no `livekit-server-sdk`, and no LiveKit secrets on
our side. The browser just calls that endpoint.

- A browser-side `fetchToken(room: string)` helper that issues
  `GET <endpoint>/token?room=<name>` and returns a typed result: either
  `{ token, url }` or a typed **"unavailable"** outcome (network error, non-200,
  malformed body). It **never throws** — the HUD reads this seam to decide
  whether Connect is enabled.
- The endpoint base URL comes from a **`VITE_TOKEN_ENDPOINT`** env var
  (`VITE_`-prefixed so Vite exposes it to the browser; it is **not** a secret —
  it's a public tunnel URL). The current ngrok URL is documented as the default
  in `.env.example`. This survives the ngrok free URL rotating on restart without
  a code edit.
- **Graceful degrade:** when `VITE_TOKEN_ENDPOINT` is unset, or the fetch fails /
  returns a bad response, the HUD disables **Connect** and shows an explanatory
  status; the plain sandbox still loads and runs.
- **Agent dispatch is not ours** — the external token server (or the brain
  worker) dispatches the agent into the room. We only fetch a token and join.

No new runtime dependency is required for this slice (`fetch` is built in).

## Acceptance criteria

- [ ] `fetchToken(room)` calls `GET <VITE_TOKEN_ENDPOINT>/token?room=<name>` and
      returns `{ token, url }` on success and a typed "unavailable" outcome on
      missing env / network error / non-200 / malformed body — never throwing.
- [ ] `.env.example` documents `VITE_TOKEN_ENDPOINT` (with the current ngrok URL
      as the default value) and explains it is a public URL, not a secret.
- [ ] No `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (or any minting code) exists on
      our side; we never construct a JWT in this repo.
- [ ] With `VITE_TOKEN_ENDPOINT` absent or the endpoint failing, Connect is
      disabled and the HUD explains why; the sandbox still loads.
- [ ] `pnpm build` (tsc strict, no unused symbols) is clean.

## Blocked by

- None — can start immediately
