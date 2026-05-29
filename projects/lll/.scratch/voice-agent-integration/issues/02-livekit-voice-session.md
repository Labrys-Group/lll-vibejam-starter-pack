# 02 — Live voice session: connect, mic, audio, receive commands over the data channel

Status: ready-for-human
Type: HITL

## Parent

PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

Replace the mock injector's transport with a real LiveKit room so commands arrive
over the data channel and the player can speak/hear the agent. Reuses the
`parseCommand` → `applyCommand` path from issue 01 unchanged.

- **Token fetch** — an **external token server** (run by the brain team) mints
  the room-join JWT; we do **not** mint tokens. A browser `fetchToken(room)`
  helper calls `GET <VITE_TOKEN_ENDPOINT>/token?room=<name>` and reads back
  `{ token, url }` (see issue 02a). No `livekit-server-sdk`, no LiveKit secrets,
  no server code on our side. The endpoint base URL comes from the
  `VITE_TOKEN_ENDPOINT` env var (a public URL, not a secret); `.env.example`
  documents it. Agent dispatch is owned by the external server, **not us**. When
  the env var is missing or the endpoint errors, `fetchToken` returns a typed
  "unavailable" outcome.
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

- [ ] `fetchToken(room)` calls the external `GET /token?room=<name>` endpoint and
      returns `{ token, url }`; a typed "unavailable" outcome when the endpoint is
      missing/erroring (no minting or secrets on our side).
- [ ] Clicking Connect joins the room, publishes the mic, and plays agent audio after
      the user gesture; Disconnect cleans up tracks/audio with no zombie voices.
- [ ] Commands sent over the data channel move the character via the issue-01 path;
      `state` messages update the HUD; `speech` updates the subtitle.
- [ ] With env/token missing, Connect is disabled and the HUD explains why; the
      sandbox still loads.
- [ ] `pnpm build` is clean.

## Blocked by

- Issue 01 — Tank-control movement driven by the command protocol
