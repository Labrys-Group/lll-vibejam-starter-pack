# 03 — Outbound sense reporting (game → agent)

Status: ready-for-agent
Type: AFK

## Parent

PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

Let the game tell the agent what it perceives, so the brain's next decision is
grounded in current game state.

- **Sense builder** — a pure `buildSense(state): SensePayload` producing
  `{ type: 'sense', position, facing, moving, bounds, nearby }`. `facing` is the yaw
  in degrees (0–360); `bounds` come from the play bounds; `nearby` is an empty array
  for the baseline sandbox (puzzle objects are future work).
- **Publishing** — over the LiveKit data channel (reliable) on meaningful events:
  on connect, after a command is applied, and on a bounds hit. Must not flood the
  channel every frame.
- **Tests (Vitest)** — `sense` test asserting payload shape/values from a state
  fixture and an empty `nearby`.

## Acceptance criteria

- [ ] `buildSense` returns the documented payload with correct position, facing
      (degrees), moving flag, bounds, and empty `nearby`; it is pure (no I/O).
- [ ] A `sense` payload is published on connect, after each applied command, and on a
      bounds hit — not every frame.
- [ ] `pnpm test` passes the `sense` test; `pnpm build` is clean.

## Blocked by

- Issue 02 — Live voice session (needs the session/data channel to publish on)
