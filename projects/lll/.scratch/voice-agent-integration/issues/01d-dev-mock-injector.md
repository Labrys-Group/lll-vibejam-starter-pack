# 01d — Dev mock injector

Status: ready-for-agent
Type: AFK

## Parent

Issue: `.scratch/voice-agent-integration/issues/01-tank-control-command-protocol.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

A dev-only way to feed the exact JSON the brain will later send, so the whole
game-side pipeline is verifiable offline with **no LiveKit involved**.

- Hidden HUD buttons and a `window.__inject(json)` entry point that push raw command
  JSON through `parseCommand` → `applyCommand` into the live intent.
- The injector is **inert in production** — no HUD, no `window.__inject`, no effect
  in the production build.

## Acceptance criteria

- [ ] `window.__inject(json)` and the hidden HUD buttons route raw JSON through
      `parseCommand` → `applyCommand`; injecting `pivot left/right` rotates the
      character in place, `forward` drives along facing, `stop` halts it.
- [ ] The injector and `window.__inject` are absent / inert in the production build.
- [ ] `pnpm build` (tsc strict, no unused symbols) is clean and `pnpm test` still passes.

## Blocked by

- `.scratch/voice-agent-integration/issues/01c-wire-tank-control-render-loop.md`
