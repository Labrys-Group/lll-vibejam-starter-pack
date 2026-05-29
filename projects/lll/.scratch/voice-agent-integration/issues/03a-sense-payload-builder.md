# 03a — `buildSense` payload builder + Vitest test

Status: ready-for-agent
Type: AFK

## Parent

Issue: `.scratch/voice-agent-integration/issues/03-outbound-sense-reporting.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

The pure "game state → outbound sense JSON" layer, as a standalone module with no
dependency on Three.js, the render loop, or LiveKit. This is the single testable
place that computes what the agent perceives.

- A pure `buildSense(state): SensePayload` producing
  `{ type: 'sense', position, facing, moving, bounds, nearby }`:
  - `position` — the character's `{ x, z }`.
  - `facing` — the yaw expressed in **degrees**, normalized to `0–360`.
  - `moving` — a boolean derived from current velocity (or the drive intent).
  - `bounds` — `{ x: [...], z: [...] }` taken from `config.PLAY_BOUNDS`.
  - `nearby` — an empty array `[]` for the baseline sandbox (puzzle objects are
    future work and out of scope here).
- The function must be **pure**: same input → same output, no I/O, no globals.
- A table-driven `sense` Vitest test asserting the payload shape, `type: 'sense'`,
  correct `position` / `facing` (degrees) / `moving` / `bounds`, and an empty
  `nearby`, from a `MovementState`-style fixture.

The wire shape is the shared inter-team contract in the PRD ("Wire contract →
Outbound"). `facing` is the **yaw-in-degrees** form (the spec's `"north"` cardinal
alternative is not used here).

## Acceptance criteria

- [ ] `buildSense` returns the documented payload with correct `position`, `facing`
      in degrees (0–360), `moving` flag, `bounds` from `PLAY_BOUNDS`, and empty
      `nearby`.
- [ ] `buildSense` is pure — no I/O, no reliance on mutable module state.
- [ ] `pnpm test` runs the `sense` test (payload shape/values from a fixture +
      empty `nearby`) and it passes.
- [ ] `pnpm build` (tsc strict, no unused symbols) is clean.

## Blocked by

- `.scratch/voice-agent-integration/issues/01a-command-protocol-and-vitest.md`
  (the Vitest harness + `test` script)
