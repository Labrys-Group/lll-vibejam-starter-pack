# PRD: Voice-Agent Integration (LiveKit brain → lll game)

Status: ready-for-agent

> Scope note: This PRD covers the **browser-side** integration in the `lll`
> Vite/TypeScript app only. Room-join tokens are minted by an **external token
> server** (run by the brain team) at `GET /token?room=<name>` → `{ token, url }`;
> we never mint tokens or hold LiveKit secrets. The Python `livekit-agents` brain
> (`brain.py` / `agent.py`) is a **separate service** (out of scope here); we only
> pin the JSON contract it must speak. Source spec:
> [voice-agent-spec](https://www.notion.so/labrys/voice-agent-spec-36fced2a7e1380a9a038c374d9ca953a).

## Problem Statement

`lll` is a walkable Three.js sandbox: a single character driven by WASD/arrow
keys, Shift to run. The long-term goal (see `README.md` roadmap) is to drive the
character **by voice** through an agentic AI brain. Today there is no path for an
external agent to move the character or speak back to the player — the only input
is the local keyboard, and the character has no way to receive commands or report
what it senses.

A player wants to put on a headset, say "turn left and walk forward until you
reach the rock," and watch the character obey while the agent narrates aloud —
without touching the keyboard.

## Solution

Wire the `lll` browser game to a LiveKit room so a Claude-powered voice agent
(running as a separate Python service) can:

1. **Hear** the player (mic audio streamed to the agent over LiveKit).
2. **Act** on the character by sending structured JSON commands over a LiveKit
   **data channel** — limited to a small, discrete tool set: **pivot left,
   pivot right, forwards, stop, speech**.
3. **Speak** back to the player (agent TTS audio played in the browser).
4. **Sense** the world: after each game event the browser publishes a compact
   "sense" snapshot (character position, facing, nearby objects, bounds) back to
   the agent so its next decision is grounded in current game state.

From the player's perspective: click **Connect**, grant mic access, and start
talking. The character pivots and walks on command; the agent's voice plays; a
small HUD shows whether the agent is listening / thinking / speaking.

Agent-driven control runs **alongside** the existing keyboard controls — WASD
still works for manual testing — and both feed a single shared movement step.

## User Stories

1. As a player, I want a **Connect** button on the sandbox HUD, so that I can opt
   into a voice session with a deliberate user gesture (required for browser audio).
2. As a player, I want my microphone audio streamed to the agent after I connect,
   so that the agent can hear my spoken instructions.
3. As a player, I want to grant mic permission through the normal browser prompt,
   so that I stay in control of when the agent is listening.
4. As a player, I want to hear the agent's spoken responses played automatically
   in the browser, so that the interaction feels like a conversation.
5. As a player, I want to say "pivot left" and see the character rotate left in
   place, so that I can aim its facing direction by voice.
6. As a player, I want to say "pivot right" and see the character rotate right in
   place, so that I can aim its facing direction by voice.
7. As a player, I want to say "go forward" / "walk" and see the character move in
   the direction it is currently facing, so that I can drive it by voice.
8. As a player, I want to say "stop" and see the character decelerate to a halt,
   so that I can end a movement at any time.
9. As a player, I want the character to keep executing the last movement command
   until I issue a new one (continuous, not one-shot), so that "forward" means
   "keep walking" rather than "step once."
10. As a player, I want the character to play the correct animation (idle while
    stopped/pivoting-in-place, walk/run while moving) under agent control, so that
    agent-driven motion looks the same as keyboard motion.
11. As a player, I want the character to stay clamped inside the play bounds under
    agent control, so that voice commands can't drive it off the map.
12. As a player, I want a HUD indicator of the agent state (listening / thinking /
    speaking / disconnected), so that I know whether the agent heard me and what
    it's doing.
13. As a player, I want to see the agent's current spoken line as on-screen text
    (subtitle), so that I can follow along if audio is unclear.
14. As a player, I want movement to begin the moment the agent **starts** speaking
    (not after it finishes), so that action and narration feel simultaneous.
15. As a player, I want a **Disconnect** action, so that I can end the voice
    session and stop the mic and agent audio cleanly.
16. As a player, I want the keyboard (WASD/Shift) to keep working while connected,
    so that I can still drive or correct the character manually.
17. As a developer, I want raw inbound data-channel payloads validated before they
    touch game state, so that a malformed or unexpected message can't crash the
    render loop or move the character incorrectly.
18. As a developer, I want unknown action types and out-of-range fields rejected
    (and logged), so that protocol drift fails loudly instead of silently.
19. As a developer, I want a single typed `AgentCommand` union representing the
    five tools, so that the rest of the game code never parses raw JSON.
20. As a developer, I want agent commands and keyboard input to feed one shared
    movement model, so that there is no second copy of the movement/animation/bounds
    logic to keep in sync.
21. As a developer, I want a pure, deterministic movement-intent module (commands +
    `dt` → yaw/position/velocity deltas), so that I can unit-test movement without a
    browser, GPU, or LiveKit connection.
22. As a developer, I want a "sense" snapshot builder that turns current game state
    into the outbound JSON payload, so that what the agent perceives is computed in
    one testable place.
23. As a developer, I want the browser to publish a sense snapshot after meaningful
    game events (connect, command applied, bounds hit), so that the agent's context
    stays fresh without flooding the channel every frame.
24. As a developer, I want the browser to fetch a LiveKit token from the external
    token server (`GET /token?room=<name>`), so that I can run the whole loop
    without standing up any token-minting server of my own.
25. As a developer, I want the token-server base URL configured via a
    `VITE_TOKEN_ENDPOINT` env var (a public URL, not a secret), so that the ngrok
    tunnel rotating doesn't require a code change.
26. As a developer, I want agent dispatch owned entirely by the external token
    server / brain worker (not this repo), so that the game side has no LiveKit
    credentials and no dispatch logic to maintain.
27. As a developer, I want the agent audio `<audio>` elements cleaned up on
    track-unsubscribe and disconnect, so that duplicate/zombie voices don't stack up
    on reconnect.
28. As a developer, I want the JSON command contract documented in one place, so
    that the separate Python brain and the game agree on the wire format.
29. As a developer, I want connection failures (no token, bad creds, room join
    error) surfaced in the HUD status instead of failing silently, so that I can
    tell setup problems from agent problems.
30. As a developer, I want the integration to degrade gracefully when LiveKit env
    vars are absent (Connect button disabled with an explanatory status), so that the
    plain sandbox still runs for contributors without credentials.

## Implementation Decisions

### Module map (browser, `src/`)

The integration is decomposed into pure deep modules (testable in isolation) and
thin I/O shells (manual/integration-verified). Existing modules `config.ts`,
`manifest.ts`, `helpers.ts` are reused as-is; `main.ts` is refactored to delegate
movement to the new intent module.

- **`commands.ts` (deep, new)** — the command protocol. Defines the typed
  `AgentCommand` union and a pure `parseCommand(raw: unknown): ParseResult`
  that validates an inbound data-channel message and returns either a typed
  command or a structured rejection (never throws). This is the only place raw
  agent JSON is interpreted. Simple interface, encapsulates all validation,
  rarely changes.
- **`movement.ts` (deep, new)** — the shared movement model. Holds the
  character's control **intent** and advances it per frame. Exposes:
  - `applyCommand(intent, command)` — fold an `AgentCommand` into the intent.
  - `applyKeyboard(intent, input)` — fold keyboard state into the same intent.
  - `stepMovement(state, intent, dt)` — pure function returning the next
    position, yaw, velocity, bob, and the desired animation key, given current
    state + intent + `dt`. Bounds-clamping lives here.
  This is the single source of truth for movement/animation/bounds. `main.ts`'s
  `updatePlayer` becomes a thin caller that maps the result onto the Three.js
  group + mixer.
- **`sense.ts` (deep, new)** — `buildSense(gameState): SensePayload`. Pure
  builder turning character position/facing + nearby/world facts into the
  outbound `{ type: 'sense', ... }` payload. No I/O.
- **`agentSession.ts` (thin shell, new)** — LiveKit client wrapper around
  `livekit-client` (the npm package for `client-sdk-js`). Owns the `Room`,
  connect/disconnect, **mic-only** publish (`localParticipant.setMicrophoneEnabled(true)`,
  not camera), agent-audio attach/cleanup, and the `DataReceived` → `parseCommand`
  → `applyCommand` wiring. Publishes sense snapshots via `buildSense`. Emits
  agent-state changes to the HUD. Connection I/O is injected/seamed so it isn't
  unit-tested directly.
  - **Audio in:** `RoomEvent.TrackSubscribed` → `track.attach()` (append element);
    `RoomEvent.TrackUnsubscribed` → `track.detach()` (the SDK removes its own
    elements — no manual `<audio>` bookkeeping).
  - **Autoplay:** subscribe to `RoomEvent.AudioPlaybackStatusChanged`; if
    `!room.canPlaybackAudio`, call `room.startAudio()` from inside the Connect
    click handler (must run in a user gesture).
  - **Data:** `room.localParticipant.publishData(bytes, { reliable: true })`
    out; `RoomEvent.DataReceived` in.
- **`mockInjector.ts` (dev affordance, new)** — a dev-only control (hidden HUD
  buttons + `window.__inject(json)`) that feeds the **exact same** data-channel
  JSON the brain will send through `parseCommand` → `applyCommand`. Lets the whole
  game side be verified before the brain exists; compiled out / inert in production.
- **`main.ts` (modified)** — wires the new pieces: instantiates the intent,
  routes keyboard through `applyKeyboard`, drives the loop through
  `stepMovement`, mounts the HUD Connect/Disconnect + state/subtitle, and owns
  the `agentSession` lifecycle.

### Token server / tooling

- **External token server (not ours)** — an existing server, run by the brain
  team, mints the room-join JWT and owns agent dispatch:
  ```
  GET <endpoint>/token?room=<name>  →  { "token": "<JWT>", "url": "wss://<project>.livekit.cloud" }
  ```
  This repo holds **no LiveKit secrets, no `livekit-server-sdk`, and no
  token-minting or dispatch code**. We removed the planned Vite `POST /api/token`
  middleware — there is nothing to mint or dispatch on our side.
- **Browser `fetchToken(room)` helper** — issues `GET <base>/token?room=<name>`
  and returns either `{ token, url }` or a typed **"unavailable"** outcome
  (missing env / network error / non-200 / malformed body); it never throws. The
  HUD reads this seam to decide whether Connect is enabled.
- **New runtime deps:** `livekit-client` (browser) only. **New dev dep:**
  `vitest` (test runner — none exists today). Installed with **pnpm** (repo uses
  `pnpm-lock.yaml`; do not run npm). No `livekit-server-sdk`.
- **Env var** (browser-exposed, **not a secret**): `VITE_TOKEN_ENDPOINT` — the
  base URL of the external token server (the ngrok tunnel). `VITE_`-prefixed so
  Vite exposes it to the client; documented in `.env.example` with the current
  ngrok URL as the default so the tunnel rotating doesn't require a code edit.
  When unset (or the endpoint errors), `fetchToken` returns "unavailable" and the
  browser disables Connect with an explanatory HUD status.

### Wire contract (browser ⇄ agent) — SHARED INTER-TEAM INTERFACE

> The Python brain is built by a **separate team**. This contract is therefore a
> shared interface both teams implement against, not an internal detail. It must
> be **mirrored to the Notion spec page** and **versioned** — any change is a
> coordinated change on both sides. The game team develops against it via the
> mock injector until the brain's worker is live.

Transport: LiveKit data channel, reliable.

**Inbound — agent → game** (`type: "action"`). The five tools map to a discrete,
**continuous-until-changed** command set:

```jsonc
// pivot in place (rotates facing; no translation)
{ "type": "action", "action": "pivot", "direction": "left" }
{ "type": "action", "action": "pivot", "direction": "right" }
// drive along current facing (keeps moving until a new command arrives)
{ "type": "action", "action": "forward", "speed": 1.0 }   // speed optional, default 1.0
// halt (decelerate to rest)
{ "type": "action", "action": "stop" }
// speech is delivered as TTS audio; this optional message carries the subtitle text
{ "type": "action", "action": "speech", "speech": "Heading for the rock." }
```

`speech` may also ride along on any of the movement messages as a `speech`
field, mirroring the spec's "say + do in parallel" pattern. `parseCommand`
rejects unknown `action` values, missing required fields, and out-of-range
`speed`.

**Inbound — agent state** (`type: "state"`): `{ "type": "state", "state":
"listening" | "thinking" | "speaking" }` → drives the HUD indicator.

**Outbound — game → agent** (`type: "sense"`, reliable):

```jsonc
{
  "type": "sense",
  "position": { "x": 0, "z": 4 },
  "facing": "north" /* or yaw degrees */,
  "moving": false,
  "bounds": { "x": [-24, 24], "z": [-8, 10] },
  "nearby": [ /* object name + relative bearing/distance, [] for the baseline sandbox */ ]
}
```

### Movement model decision (tank-style intent)

The five tools are **character-relative**, unlike current WASD world-direction
strafing. Decision: introduce a tank-style intent — `pivot` adjusts a target
yaw; `forward` sets a forward drive flag along current facing; `stop` clears it.
Keyboard maps onto the **same** intent (W/S = forward/back drive, A/D = pivot, or
retain world-direction mapping internally but normalize into the shared intent),
so both control paths converge before `stepMovement`. Reuse existing helpers:
`yawFromDirection`/`dampAngle` for facing (asset faces **+Z** at yaw 0),
`pickActionName` for animation selection, `THREE.MathUtils.damp` for accel/decel,
and the existing `bobTimer` bob. Bounds from `config.PLAY_BOUNDS`.

### Action-on-speech timing

Per the spec, a movement action takes effect when the agent enters the
`speaking` state (TTS start), not when speech ends. On the browser side this is
naturally satisfied because the action message arrives over the data channel
independently of audio; the game applies it immediately on receipt. The HUD
subtitle updates from the `speech` field / `state` message.

## Testing Decisions

**What makes a good test here:** assert **external behavior** through each
module's public interface, not internals. Tests must run headless with **no
browser, no GPU, no LiveKit, no network** — which is exactly why the pure modules
(`commands`, `movement`, `sense`) are carved out from the I/O shell
(`agentSession`) and the Three.js wiring (`main`).

- **`commands.ts` — `parseCommand`:** table-driven tests. Valid messages for each
  of the five tools parse to the expected typed command; unknown `action`,
  missing required fields, wrong types, and out-of-range `speed` are rejected with
  a structured error (and never throw). This is the protocol's contract test.
- **`movement.ts` — `stepMovement` / `applyCommand` / `applyKeyboard`:**
  deterministic sequences. Given an intent and a fixed `dt`, assert: `pivot left`
  decreases yaw toward target and produces no translation; `forward` advances
  position along current facing and selects a walk/run animation key; `stop`
  decelerates velocity toward zero and selects idle; positions are clamped to
  `PLAY_BOUNDS`; keyboard and the equivalent agent command produce the same
  next-state. Pure functions + fixed `dt` make this fully reproducible.
- **`sense.ts` — `buildSense`:** given a game-state fixture, assert the emitted
  payload shape, `type: "sense"`, correct position/facing/moving/bounds, and an
  empty `nearby` for the baseline sandbox.

**Not unit-tested:** `agentSession.ts` (LiveKit I/O) and the Vite token
middleware — verified manually end-to-end and, optionally, with a mocked
transport later. No browser/WebGL rendering assertions in this PRD.

**Prior art:** no test runner exists in `lll` today — this PRD introduces Vitest.
The repo's `playwright-testing` shared skill documents the team's testing
approach and can guide any later browser/E2E coverage, but the unit tests above
are plain Vitest on pure functions and need no DOM.

## Out of Scope

- The **Python `livekit-agents` brain** (`brain.py`, `agent.py`, system prompt,
  Deepgram STT, Cartesia TTS, Claude wiring). Separate service; this PRD only
  pins the JSON wire contract it must honor.
- **Token minting and agent dispatch** — owned by the external token server / the
  brain team. This repo never mints JWTs, holds LiveKit secrets, or dispatches
  agents; no serverless function or token-endpoint deployment is in scope.
- The **puzzle layer** (objects, goals, win conditions) from the roadmap. The
  `nearby` sense field is specified but ships empty for the baseline sandbox.
- New **tools beyond the five** (pivot left, pivot right, forwards, stop, speech)
  — e.g. pickup, interact, variable-speed steering by degrees.
- Multi-character / multi-agent rooms, and persistence of conversation state
  across reloads.
- Browser/WebGL **rendering** or E2E tests (only pure-module unit tests here).

## Further Notes

- **livekit-agents 1.5.x gotchas** (from the spec) apply to the separate Python
  service and the **external token server** — dispatch must use explicit
  `AgentDispatchClient.createDispatch()` (passive auto-dispatch is gone), ideally
  `listDispatches` first to avoid duplicate agents/voices. That is **the external
  server's responsibility, not ours.** On the browser, our only related duty is to
  clean up attached `<audio>` elements on track-unsubscribe and on disconnect to
  prevent stacked voices on reconnect.
- **`startAudio()` must be called inside a user gesture** — hence the explicit
  Connect button (user story 1). Autoplay of agent audio depends on it.
- Keep **`.ts` extensions in imports** and `import * as THREE from 'three'` /
  `three/addons/...` per the project's Vite 8 + `moduleResolution: bundler` setup.
  Add the token endpoint input via `build.rolldownOptions` conventions if any new
  HTML entry is needed (none expected — `/game/` is unchanged).
- `pnpm build` (tsc strict, `noUnusedLocals`/`noUnusedParameters`) is the only
  correctness gate besides Vitest — keep new symbols used and typed.
- Shared agent skills (`threejs-builder`, `playwright-testing`) are duplicated
  under `.claude/skills/` and `.agents/skills/`; only touch them if a skill
  change is needed, and then update **both** trees.
