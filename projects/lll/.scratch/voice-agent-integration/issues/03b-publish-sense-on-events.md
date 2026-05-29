# 03b — Publish sense over the data channel on meaningful events

Status: ready-for-human
Type: HITL

## Parent

Issue: `.scratch/voice-agent-integration/issues/03-outbound-sense-reporting.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

Make the game actually report what it perceives to the agent, so the brain's next
decision is grounded in current game state. Wire the `03a` `buildSense` builder
into the session shell and publish its payload over the LiveKit data channel.

- On meaningful events, build a sense payload and publish it reliably
  (`publishData(bytes, { reliable: true })`):
  - **on connect** (initial snapshot once the room is joined),
  - **after each applied command** (the agent's action changed the world),
  - **on a bounds hit** (the character was clamped at the edge of `PLAY_BOUNDS`).
- Add a guard so sense is **not** published every frame — only on the events above
  (e.g. debounce/dedupe, or emit only on state-change). The channel must not flood.
- Reuse the `03a` builder unchanged — no second copy of the payload-shaping logic.

This slice is **HITL**: verification runs in a live room — a human connects, drives
the character (via keyboard or the injector/test publisher), and confirms a `sense`
payload lands on the channel on connect, after a command, and on a bounds hit, and
that it is *not* emitted every frame.

## Acceptance criteria

- [ ] A `sense` payload (from `03a` `buildSense`) is published reliably on connect,
      after each applied command, and on a bounds hit.
- [ ] Sense is **not** published every frame — confirmed by observing channel
      traffic in a live room.
- [ ] Verified end-to-end in a live room (payloads observed at the right times via
      the test publisher / injector path).
- [ ] `pnpm build` (tsc strict, no unused symbols) is clean and `pnpm test` still
      passes.

## Blocked by

- `.scratch/voice-agent-integration/issues/03a-sense-payload-builder.md`
- `.scratch/voice-agent-integration/issues/02-livekit-voice-session.md`
  (the live session / data channel to publish on)
