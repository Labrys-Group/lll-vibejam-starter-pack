# 02c — Inbound data-channel routing to the game + HUD

Status: ready-for-human
Type: HITL

## Parent

Issue: `.scratch/voice-agent-integration/issues/02-livekit-voice-session.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

Make data arriving over the LiveKit channel actually move the character and
update the HUD, reusing the issue-01 `parseCommand` → `applyCommand` path
unchanged.

- On `RoomEvent.DataReceived`, decode the payload and route by `type`:
  - `type: 'action'` → through `parseCommand` → `applyCommand` into the shared
    movement intent (pivot/forward/stop drive the character; malformed messages
    are rejected, never crash the loop), and update the subtitle from any
    `speech` field.
  - `type: 'state'` → drive the HUD agent-state indicator
    (listening / thinking / speaking).
- Reuse the issue-01 pipeline **as-is** — no second copy of the parse/apply/
  movement logic.

Until the brain exists, exercise inbound commands with a small **test data
publisher** (or the issue-01 injector re-pointed at `publishData`) so the routing
is driven over the real data channel.

This slice is **HITL**: verification runs in a live room — a human publishes
`action` / `state` / `speech` payloads over the channel and confirms the
character moves, the indicator changes, and the subtitle updates.

## Acceptance criteria

- [ ] Commands sent over the data channel move the character via the issue-01
      `parseCommand` → `applyCommand` path (pivot/forward/stop).
- [ ] `state` messages update the HUD indicator; `speech` (standalone or riding on
      a movement message) updates the subtitle.
- [ ] Malformed / unknown payloads are rejected and logged without crashing the
      render loop.
- [ ] Verified in a live room with a test data publisher (or the 01d injector
      re-pointed at `publishData`).
- [ ] `pnpm build` (tsc strict, no unused symbols) is clean and `pnpm test` still
      passes.

## Blocked by

- `.scratch/voice-agent-integration/issues/02b-session-shell-mic-audio.md`
- `.scratch/voice-agent-integration/issues/01c-wire-tank-control-render-loop.md`
