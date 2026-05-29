# 02 — Live voice session: connect, mic, audio, receive commands over the data channel

Status: ready-for-human
Type: HITL

## Parent

PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

Replace the mock injector's transport with a real LiveKit room so commands arrive
over the data channel and the player can speak/hear the agent. Reuses the
`parseCommand` → `applyCommand` path from issue 01 unchanged.

- **Token endpoint** — a Vite dev middleware `POST /api/token` that mints a
  room-join JWT with `livekit-server-sdk` and returns `{ token, url }`. Reads
  `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` server-side only (never
  bundled); add `.env.example` and load via Vite `loadEnv`. Agent dispatch is **out
  of scope here** (issue 04). When env is missing it returns a clear error.
- **Session shell** (`livekit-client`) — connect to the room; publish **mic only**
  (`setMicrophoneEnabled(true)`); attach agent audio on `TrackSubscribed`
  (`track.attach()`) and clean up on `TrackUnsubscribed` (`track.detach()`); handle
  autoplay via `AudioPlaybackStatusChanged` + `room.canPlaybackAudio` by calling
  `room.startAudio()` inside the Connect click handler. On `DataReceived`, route
  `type:'action'` through `parseCommand` → `applyCommand` (and update the subtitle
  from `speech`); route `type:'state'` to the HUD indicator.
- **HUD** — Connect / Disconnect controls, an agent-state indicator
  (disconnected / listening / thinking / speaking), and a subtitle line. Disconnect
  tears down tracks and audio cleanly (no stacked voices on reconnect).
- **Graceful degrade** — when the token endpoint errors or env is absent, disable
  Connect and show an explanatory HUD status; the plain sandbox still runs.

This slice is **HITL**: a human runs the connect flow with real credentials in a
browser and confirms mic publish + agent audio playback. Until the brain exists,
exercise inbound commands with a small test data publisher (or the issue-01 injector
re-pointed at `publishData`).

## Acceptance criteria

- [ ] `POST /api/token` returns `{ token, url }` with valid creds and a clear error
      without them; secrets never reach the browser bundle.
- [ ] Clicking Connect joins the room, publishes the mic, and plays agent audio after
      the user gesture; Disconnect cleans up tracks/audio with no zombie voices.
- [ ] Commands sent over the data channel move the character via the issue-01 path;
      `state` messages update the HUD; `speech` updates the subtitle.
- [ ] With env/token missing, Connect is disabled and the HUD explains why; the
      sandbox still loads.
- [ ] `pnpm build` is clean.

## Blocked by

- Issue 01 — Tank-control movement driven by the command protocol
