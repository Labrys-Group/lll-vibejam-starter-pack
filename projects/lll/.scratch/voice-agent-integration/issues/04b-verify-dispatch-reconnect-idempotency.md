# 04b — Verify external agent dispatch + reconnect idempotency

Status: ready-for-human
Type: HITL

## Parent

Issue: `.scratch/voice-agent-integration/issues/04-agent-dispatch-e2e-voice.md`
PRD: `.scratch/voice-agent-integration/PRD.md`

## What to build

Confirm — **don't build** — that agent dispatch into the room works end-to-end.
Dispatch is owned entirely by the **external token server / brain worker**: this
repo does not mint tokens, call `AgentDispatchClient`, or hold any dispatch logic.
This slice only verifies the externally-owned behavior and raises a bug with the
brain team if it doesn't hold.

- With the brain worker live, fetch a token for a room (via the issue 02a path) and
  confirm **the agent joins that room** as a result.
- Reconnect to the same room repeatedly and confirm the join is **idempotent**: no
  duplicate agents and no duplicate voices accumulate across reconnects.
- If either fails, that is a bug to raise with the brain team — there is no code to
  add in this repo to fix it.

## Acceptance criteria

- [ ] Fetching a token for a room (via the external endpoint) results in the agent
      joining that room. Verified against the external server — no dispatch code
      lives in this repo.
- [ ] Reconnecting produces no duplicate agents and no duplicate voices.
- [ ] Any dispatch/idempotency failure observed is filed against the brain team, not
      worked around in this repo.

## Blocked by

- `.scratch/voice-agent-integration/issues/02-livekit-voice-session.md`
