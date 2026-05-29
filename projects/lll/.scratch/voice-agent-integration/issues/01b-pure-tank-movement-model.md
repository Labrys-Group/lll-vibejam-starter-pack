# 01b — Pure tank movement model

Status: ready-for-agent
Type: AFK

## Parent

Issue: `.scratch/voice-agent-integration/issues/01-tank-control-command-protocol.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

The deterministic, pure movement core of the pipeline — no Three.js scene-graph or
DOM, so it is fully unit-testable in isolation.

- A single shared `ControlIntent` describing the desired motion (turn direction,
  drive on/off, run flag) that both keyboard and (later) agent commands fold into.
- A **pure** `stepMovement(state, intent, dt)` returning the next
  position/yaw/velocity/bob and the desired animation key:
  - `pivot` rotates facing in place (no translation),
  - `forward` drives along current facing (continuous until changed),
  - `stop` decelerates to rest,
  - position clamps to the play bounds (`PLAY_BOUNDS`),
  - returned anim key reflects idle (stopped/pivoting) vs walk/run (driving).
- `applyKeyboard(intent, input)` folds keyboard state into the shared intent.

`applyCommand` (mapping an `AgentCommand` → intent) is intentionally deferred to
01c, where the command protocol and movement model meet — keep this slice free of
any dependency on the command types.

Add deterministic `movement` tests (Vitest, fixed `dt`) against the harness 01a
introduces: pivot changes yaw only; forward advances along facing + selects
walk/run; stop decelerates + selects idle; bounds clamp; keyboard intent produces
the expected motion.

## Acceptance criteria

- [ ] `stepMovement` is pure (same inputs → same outputs; no Three.js/DOM side effects).
- [ ] Deterministic `movement` tests pass: pivot changes yaw only; forward advances
      along facing with walk/run anim; stop decelerates to idle; position clamps to bounds.
- [ ] `applyKeyboard` folds keyboard state into the shared `ControlIntent`.
- [ ] `pnpm test` passes (`movement` suite); `pnpm build` (tsc strict, no unused symbols) is clean.

## Blocked by

- None — can start immediately (parallel with 01a). Relies on the Vitest harness from
  01a; if run in a separate worktree, ensure Vitest is available or validate at the 01c merge.
