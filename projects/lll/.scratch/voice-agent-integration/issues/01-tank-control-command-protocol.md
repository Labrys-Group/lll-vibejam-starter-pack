# 01 — Tank-control movement driven by the command protocol (mock injector)

Status: ready-for-agent
Type: AFK

## Parent

PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

The complete game-side path from a JSON command to character motion, with **no
LiveKit involved** — verifiable entirely offline.

Introduce a typed command protocol and a tank-style movement model, wire both into
the existing render loop, and add a dev-only mock injector that feeds the exact
JSON the brain will later send.

- **Command protocol** — a `parseCommand(raw): ParseResult` that turns one inbound
  `{ type: 'action', ... }` message into a typed `AgentCommand` union for the five
  tools (`pivot left/right`, `forward`, `stop`, `speech`) or a structured rejection.
  It must never throw. Unknown actions, missing/typed-wrong fields, and out-of-range
  `speed` are rejected. `speech` may ride along on any movement message.
- **Tank movement model** — a single shared `ControlIntent` and a **pure**
  `stepMovement(state, intent, dt)` returning next position/yaw/velocity/bob and the
  desired animation key. `pivot` rotates facing in place (no translation); `forward`
  drives along current facing (continuous until changed); `stop` decelerates to rest.
  Position clamps to the play bounds. Commands and keyboard both fold into the **same**
  intent (`applyCommand`, `applyKeyboard`); when keyboard is active it overrides the
  agent intent, otherwise the agent intent persists.
- **Keyboard refactor** — A/D (←/→) pivot, W (↑) forward, S (↓) stop, Shift run.
  Existing WASD strafe is intentionally replaced by tank-style control so there is one
  command pipeline. `main.ts`'s `updatePlayer` becomes a thin caller mapping the pure
  `stepMovement` result onto the Three.js group + mixer (reuse `pickActionName`,
  `dampAngle`, `THREE.MathUtils.damp`, existing bob).
- **Mock injector (dev only)** — hidden HUD buttons + `window.__inject(json)` that
  push raw command JSON through `parseCommand` → `applyCommand`; inert in production.
- **Tests (Vitest, new)** — add Vitest + a `test` script. Table-driven `commands`
  tests (valid/invalid for all five tools; rejections never throw) and deterministic
  `movement` tests (fixed `dt`: pivot changes yaw only; forward advances along facing
  + walk/run anim; stop decelerates + idle; bounds clamp; keyboard ≡ equivalent command).

Continuous-until-changed semantics (from prototype design): each command fully sets
the intent — `pivot` → turn set, drive cleared; `forward` → drive set, turn cleared;
`stop` → both cleared; `speech` → no movement effect.

## Acceptance criteria

- [ ] `parseCommand` returns typed commands for all five tools and structured errors
      for unknown action, missing `direction`, non-finite/out-of-range `speed`, and
      missing `speech` text — and never throws.
- [ ] Injecting `pivot left/right` rotates the character in place; `forward` drives
      along its current facing; `stop` halts it; the character stays within play bounds.
- [ ] Correct animation plays under command/keyboard control (idle stopped/pivoting,
      walk/run when driving).
- [ ] Keyboard (A/D pivot, W forward, S stop, Shift run) drives the same movement path
      and overrides the agent intent when keys are pressed.
- [ ] `pnpm test` passes with `commands` and `movement` unit tests; `pnpm build`
      (tsc strict, no unused symbols) is clean.

## Blocked by

- None — can start immediately
