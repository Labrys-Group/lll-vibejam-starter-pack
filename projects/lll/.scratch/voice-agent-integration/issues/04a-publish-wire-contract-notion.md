# 04a — Publish & version the wire contract on Notion (shared inter-team interface)

Status: ready-for-human
Type: HITL

## Parent

Issue: `.scratch/voice-agent-integration/issues/04-agent-dispatch-e2e-voice.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

Mirror the wire contract from the PRD onto the Notion spec page and version it, so
the separate Python brain team implements against the exact same interface as the
game. This is the single source of truth both teams build to; any change is
coordinated on both sides.

The contract has three message shapes that must appear verbatim on Notion:

- **Inbound — agent → game** (`type: "action"`): the five discrete tools — `pivot`
  (`direction: left|right`), `forward` (optional `speed`, default `1.0`), `stop`,
  and `speech` (carries the `speech` string). Note that unknown `action` values,
  missing required fields, and out-of-range fields must be rejected by the game.
- **Inbound — agent state** (`type: "state"`): `listening | thinking | speaking`,
  which drives the HUD indicator.
- **Outbound — game → agent** (`type: "sense"`, reliable): the compact world
  snapshot (character position, facing, nearby objects, bounds).

Add an explicit **version marker** to the page so a contract revision is visible to
both teams, and confirm with the brain team that they are implementing against this
version. This slice authors documentation and coordinates — it changes no game code.

## Acceptance criteria

- [ ] The full wire contract (inbound `action`, inbound `state`, outbound `sense`)
      is published on the Notion spec page and matches the PRD / game implementation.
- [ ] The contract carries a version marker, and a contract change is understood to
      require coordination on both the game and brain sides.
- [ ] The brain team has confirmed they are building against this published version.

## Blocked by

- None — can start immediately
