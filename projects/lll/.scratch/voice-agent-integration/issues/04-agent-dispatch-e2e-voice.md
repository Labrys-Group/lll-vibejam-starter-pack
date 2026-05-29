# 04 — Real end-to-end voice with the brain team

Status: ready-for-human
Type: HITL

## Parent

PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

Close the loop with the separate team's Python brain and verify the full voice
experience.

- **Shared contract** — mirror the wire contract (inbound `action`/`state`, outbound
  `sense`) from the PRD onto the Notion spec page and version it, so the brain team
  implements against the same interface. Any change is coordinated on both sides.
- **Agent dispatch (external — verify, don't build)** — dispatch into the room is
  owned by the **external token server / brain worker**, not this repo. We do not
  mint tokens or call `AgentDispatchClient`. This slice only **confirms** that
  fetching a token for a room (issue 02a) results in the agent joining that room
  (idempotently — no duplicate agents/voices on reconnect). If it doesn't, that's a
  bug to raise with the brain team, not code to add here.
- **End-to-end verification** — with the brain worker live, confirm the full path:
  speak → STT → brain → action over data channel → character obeys, while the agent
  narrates via TTS audio, and the HUD reflects listening / thinking / speaking. Action
  begins when the agent starts speaking (not after).

This slice is **HITL**: it depends on the other team's worker + agent name and on a
human conducting a live voice session.

## Acceptance criteria

- [ ] Wire contract is published + versioned on Notion and matches the game
      implementation.
- [ ] Fetching a token for a room (via the external endpoint) results in the agent
      joining that room; no duplicate agents/voices across reconnects. (Verified
      against the external server — no dispatch code lives in this repo.)
- [ ] Live voice drives the character through the brain; agent audio plays; HUD shows
      the correct agent state; movement starts as speech begins.
- [ ] No duplicate agents/voices across reconnects.

## Blocked by

- Issue 02 — Live voice session
- Issue 03 — Outbound sense reporting (desirable, so the brain has sensory context)
