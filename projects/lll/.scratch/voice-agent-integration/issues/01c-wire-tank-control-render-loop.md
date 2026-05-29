# 01c — Wire tank control into the render loop

Status: ready-for-agent
Type: AFK

## Parent

Issue: `.scratch/voice-agent-integration/issues/01-tank-control-command-protocol.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

The integration seam where the command protocol (01a) and the pure movement model
(01b) meet the live Three.js loop. After this slice, a human can drive the
character with tank-style keys end-to-end.

- `applyCommand(intent, command)` — map an `AgentCommand` onto the shared
  `ControlIntent` with continuous-until-changed semantics: `pivot` → turn set,
  drive cleared; `forward` → drive set, turn cleared; `stop` → both cleared;
  `speech` → no movement effect.
- Both keyboard and agent intents fold into the **same** intent. When the keyboard
  is active it overrides the agent intent; otherwise the agent intent persists.
- Keyboard refactor: A/D (←/→) pivot, W (↑) forward, S (↓) stop, Shift run. The
  existing WASD strafe is intentionally replaced by tank-style control so there is
  one command pipeline.
- `main.ts`'s `updatePlayer` becomes a thin caller that maps the pure `stepMovement`
  result onto the Three.js group + mixer (reuse `pickActionName`, `dampAngle`,
  `THREE.MathUtils.damp`, and the existing bob).

## Acceptance criteria

- [ ] Pressing A/D pivots the character in place; W drives along current facing;
      S halts it; Shift runs — all within play bounds.
- [ ] Correct animation plays (idle when stopped/pivoting, walk/run when driving).
- [ ] An injected `AgentCommand` drives the same movement path via `applyCommand`;
      keyboard overrides the agent intent when keys are pressed, agent intent persists otherwise.
- [ ] `pnpm build` (tsc strict, no unused symbols) is clean and `pnpm test` still passes.

## Blocked by

- `.scratch/voice-agent-integration/issues/01a-command-protocol-and-vitest.md`
- `.scratch/voice-agent-integration/issues/01b-pure-tank-movement-model.md`
