# 04d — Full live experience: all tools, action-on-speech timing, HUD transitions

Status: ready-for-human
Type: HITL

## Parent

Issue: `.scratch/voice-agent-integration/issues/04-agent-dispatch-e2e-voice.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

Broaden the 04c tracer into the full voice experience over a sustained live session.
A human conducts a real conversation and confirms the interaction feels simultaneous
and robust across all five tools.

- Exercise all five tools across the session — `pivot` (left/right), `forward`
  (including a non-default `speed`), `stop`, and `speech` — and confirm the character
  obeys each.
- **Action-on-speech timing:** movement begins when the agent **enters the speaking
  state** (TTS start), not after speech finishes — action and narration feel
  simultaneous.
- The HUD transitions correctly through listening / thinking / speaking over the
  course of the conversation, and the subtitle reflects the spoken narration.
- **Disconnect** cleanly ends the session, and reconnecting stays clean — no
  duplicate agents or voices accumulate across reconnects.

This is the final HITL sign-off on the full voice loop.

## Acceptance criteria

- [ ] Live voice drives the character through the brain across all five tools; agent
      audio plays for each.
- [ ] Movement starts as speech begins (not after it finishes).
- [ ] The HUD shows the correct agent state throughout, and the subtitle reflects
      narration.
- [ ] Disconnect ends the session cleanly; reconnecting produces no duplicate agents
      or voices.

## Blocked by

- `.scratch/voice-agent-integration/issues/04c-e2e-tracer-single-command.md`
