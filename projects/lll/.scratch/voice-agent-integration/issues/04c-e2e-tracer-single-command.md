# 04c — End-to-end tracer: one spoken command drives the character

Status: ready-for-human
Type: HITL

## Parent

Issue: `.scratch/voice-agent-integration/issues/04-agent-dispatch-e2e-voice.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

The thinnest possible end-to-end proof that the whole pipeline is wired up: a single
spoken instruction lights up every layer once. With the brain worker live, a human
connects and speaks one command (e.g. "turn left" or "move forward").

Confirm the full path for that one command:

- speak → STT → brain → a single `action` message over the data channel → the
  character obeys,
- the agent **narrates** the action via TTS audio (a `speech` action / subtitle), and
- the HUD reflects the agent state (listening → thinking → speaking) for that one
  exchange.

This is a verification slice — no new game code is expected beyond what issues 01–03
already provide. Its job is to surface any integration gap (token, dispatch, action
routing, sense, audio, HUD) on the simplest possible interaction before broadening.

## Acceptance criteria

- [ ] A single spoken instruction drives one `action` through the brain and the
      character obeys it in the sandbox.
- [ ] The agent's narration audio plays for that command.
- [ ] The HUD shows the correct agent state across the single exchange.
- [ ] Any gap found is traced to the responsible layer/team (this repo vs. brain).

## Blocked by

- `.scratch/voice-agent-integration/issues/04b-verify-dispatch-reconnect-idempotency.md`
- `.scratch/voice-agent-integration/issues/03-outbound-sense-reporting.md`
