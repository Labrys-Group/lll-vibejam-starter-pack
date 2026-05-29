# CONTEXT — LLL

The domain glossary for the `lll` sandbox. When agent output names a concept
below (in an issue title, refactor proposal, hypothesis, test name, or code
identifier), use the term **exactly as defined here** rather than drifting to a
synonym. If a concept you need isn't listed, that's a signal — either you're
inventing language the project doesn't use, or there's a genuine gap worth
recording.

This is a Three.js 3D sandbox forked from `forest-census`. See `README.md` for
the roadmap and `CLAUDE.md` for build/toolchain rules.

## Glossary — current domain (what exists today)

**Sandbox** — the single playable scene: a flat ground plane, a faint grid, sky
background, fog, and one controllable character. There are no levels, goals, or
win conditions yet; "the sandbox" is the whole game in its baseline state.

**Player** — the one controllable character (`Character_Male_1` from the
Quaternius pack). In code, `Player` is an interface (`main.ts`) that **extends
`Actor`** and adds movement state: `group`, `velocity`, `walkSpeed`, `runSpeed`,
`accel`, `decel`, `forward`, `bobTimer`, `mixer`. Prefer "player" for the
in-world character; reserve "character" for the GLTF asset / model.

**Actor** — the shared shape for anything animated (`helpers.ts`): an `actions`
map plus the `currentAction` name. The Player is currently the only Actor;
animals and other actors are part of the inherited `forest-census` manifest but
are **not instantiated** yet.

**Group** — the `THREE.Group` that holds the player's loaded model. Movement,
yaw, and bob are applied to the group, never to the raw GLTF root. "Move the
player" means transform `player.group`.

**Action** — a `THREE.AnimationAction` wrapping one animation **clip**. Actions
live in the `actions` map keyed by **lowercase clip name** (`buildActionMap`).
The three logical actions used today are **idle**, **walk**, and **run**.

**Clip** — a raw `THREE.AnimationClip` from the GLTF. Clip names vary across the
Quaternius packs (`Walk` vs `Walk_Hold`, etc.), so never hardcode one: resolve
through **`pickActionName`**, which takes a priority-ordered candidate list and
returns the first present (case-insensitive) key. Switch the playing action with
**`playAction`** (cross-fades over `fadeSeconds`).

**Mixer** — the `THREE.AnimationMixer` driving the player's actions, advanced
each frame by `mixer.update(dt)`.

**Manifest** — the shared `public/assets.json` (the `forest-census` format:
`characters` / `animals` / `environment.{flora,resources}`). `loadManifest()`
currently resolves **only** the player (`characters.Male_1`). "Add an asset to
the manifest" means add an entry under one of those groups; "load it" means
resolve its path and pass it to `loadGltf`.

**`loadGltf`** — caches each GLTF by key and returns a **`SkeletonUtils.clone`**
so the same model can be instanced with independent animation state. Always go
through it rather than constructing a `GLTFLoader` directly.

**Play bounds** (`PLAY_BOUNDS`, `config.ts`) — the X/Z box the player is clamped
to (`x: [-24, 24]`, `z: [-8, 10]`). "In bounds" / "out of bounds" refer to this
box, not the larger ground plane (which is `80×36`).

**Camera rig** (`cameraRig`) — the side-scrolling-style follow camera. The
camera only pans along **X**; it does not orbit or follow Z. It nudges
`targetX` when the player crosses an NDC `edgeThreshold`, then damps `currentX`
toward it. "Follow the player" means this X-panning behavior specifically.

**Bob** — the subtle vertical sine motion applied to the player while
moving/idle (`bobTimer`). Cosmetic only; not physics.

## Conventions that are domain language

**Facing convention (+Z at yaw 0)** — this asset pack visually faces **+Z** when
yaw is 0. `yawFromDirection` encodes that. When discussing orientation, "facing"
means the +Z convention, not +X or camera-relative. Use **`dampAngle`** for
smooth shortest-arc turning, never a raw radian lerp.

**Ground anchoring (the two-step ritual)** — placing any new GLTF actor on the
ground is two steps: `normalizeToHeightAndGround` (scale to a target height, lift
base to y=0), then — *after* the mixer's first `update(0)` poses the skeleton —
`anchorMinYToGround` (re-measure and re-anchor). Both are required because
skinned-mesh bounds are wrong until the skeleton is posed. "Anchor to ground"
means this full ritual, not just setting `position.y = 0`.

## Glossary — planned domain (NOT built yet)

These terms appear in the roadmap (`README.md`) and describe the project's
intent. **None of this exists in code today** — do not assume any of it is
present, and flag clearly when proposing it as new work.

**Agentic brain** — a planned Vercel serverless function (`api/agent`) holding
the Anthropic API key server-side. It is meant to translate a natural-language
**instruction** into a sequence of in-world **actions** the player executes.
The `api/` directory does not exist yet.

**Instruction** — a planned natural-language command from the user ("walk to the
rock, then idle") that the agentic brain interprets. Distinct from raw keyboard
**input** (the current `InputState`: up/down/left/right/run).

**Voice input** — planned speech-to-text feeding instructions to the brain.

**Puzzle layer** — planned objects, goals, and win conditions to be solved by
instruction. There is no concept of a goal, score, or win state today.

## Naming guardrails

- "input" = direct keyboard control (`InputState`); "instruction" = planned NL
  command. Keep these distinct.
- "character" = the GLTF asset/model; "player" = the controllable in-world actor.
- "action" = the high-level idle/walk/run state played via `playAction`; "clip"
  = the raw named animation in the GLTF. Resolve clips by candidate list, never
  by hardcoded name.
- This is a `forest-census` fork: some manifest groups (animals, flora,
  resources) exist in `assets.json` but are **unused** in `lll`. Don't describe
  them as features of `lll`.
