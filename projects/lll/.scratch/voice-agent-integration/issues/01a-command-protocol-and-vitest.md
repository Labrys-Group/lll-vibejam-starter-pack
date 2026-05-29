# 01a — Command protocol (`parseCommand`) + Vitest harness

Status: ready-for-agent
Type: AFK

## Parent

Issue: `.scratch/voice-agent-integration/issues/01-tank-control-command-protocol.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

The "raw JSON → typed command" layer of the pipeline, as a pure module with no
dependency on Three.js or the render loop. This is the contract the brain will
later target, so it is the canonical home for the command types.

- A typed `AgentCommand` union covering the five tools: `pivot left`, `pivot right`,
  `forward`, `stop`, and `speech`. `speech` may ride along on any movement message
  (i.e. a movement command may also carry speech text).
- A `parseCommand(raw): ParseResult` that turns one inbound `{ type: 'action', ... }`
  message into either a typed `AgentCommand` or a **structured rejection**. It must
  **never throw** — every bad input returns a rejection value, not an exception.
- Rejections for: unknown action, missing/wrong-typed fields (e.g. missing
  `direction`), non-finite or out-of-range `speed`, and missing `speech` text.

Continuous-until-changed semantics are defined here only at the type level; the
movement effect of each command is implemented in the movement model (01b) and
wired in 01c.

This slice also stands up the test harness: add **Vitest** and a `test` script to
`package.json` (pnpm — do not run npm), and add table-driven `commands` tests.
The Vitest harness installed here is shared; 01b adds its own test file against it.

## Acceptance criteria

- [ ] `AgentCommand` union covers all five tools; `speech` can accompany a movement command.
- [ ] `parseCommand` returns typed commands for all five tools and structured errors
      for unknown action, missing `direction`, non-finite/out-of-range `speed`, and
      missing `speech` text — and **never throws** for any input.
- [ ] Vitest + a `test` script are added; `pnpm test` runs the table-driven `commands`
      tests (valid + invalid for all five tools) and they pass.
- [ ] `pnpm build` (tsc strict, no unused symbols) is clean.

## Blocked by

- None — can start immediately (parallel with 01b)
