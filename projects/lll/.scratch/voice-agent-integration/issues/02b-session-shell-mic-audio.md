# 02b — LiveKit session shell: connect / mic / agent audio + HUD controls

Status: ready-for-human
Type: HITL

## Parent

Issue: `.scratch/voice-agent-integration/issues/02-livekit-voice-session.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

The real-room I/O shell and its HUD surface: clicking Connect joins a LiveKit
room, the player can be heard, and the agent can be heard back. This is the part
that genuinely needs a human with real credentials in a browser.

- **Session shell** (`agentSession.ts`, `livekit-client`) — owns the `Room`:
  connect (using the token from 02a) and disconnect; publish **mic only**
  (`setMicrophoneEnabled(true)`, not camera); attach agent audio on
  `TrackSubscribed` (`track.attach()`) and clean up on `TrackUnsubscribed`
  (`track.detach()`); handle autoplay via `AudioPlaybackStatusChanged` +
  `room.canPlaybackAudio` by calling `room.startAudio()` **inside the Connect
  click handler** (user gesture). Connection I/O is seamed so the pure modules
  stay testable.
- **HUD** — Connect / Disconnect controls, an agent-state indicator
  (disconnected / listening / thinking / speaking), and a subtitle line. The
  state indicator and subtitle are mounted here; 02c drives their values from
  inbound data.
- **Clean teardown** — Disconnect tears down tracks and attached audio cleanly so
  reconnecting does not stack zombie voices.

Inbound data-channel routing (commands / state / speech → game + HUD) is **02c**;
this slice only stands up the `DataReceived` seam.

This slice is **HITL**: a human runs the Connect flow with real credentials and
confirms mic publish + agent audio playback, and that Disconnect leaves no
lingering voices on reconnect.

## Acceptance criteria

- [ ] Clicking Connect joins the room and publishes the mic; the browser mic
      permission prompt appears via the normal flow.
- [ ] Agent audio plays automatically after the Connect user gesture
      (`startAudio()` called inside the handler).
- [ ] Disconnect cleans up tracks and attached `<audio>` with no zombie voices on
      reconnect.
- [ ] The HUD shows Connect/Disconnect, an agent-state indicator, and a subtitle
      line (values wired in 02c).
- [ ] `pnpm build` (tsc strict, no unused symbols) is clean.

## Blocked by

- `.scratch/voice-agent-integration/issues/02a-token-endpoint-graceful-degrade.md`
