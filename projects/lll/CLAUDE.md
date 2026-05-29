# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

`lll` is a Three.js 3D sandbox forked from `forest-census`. The long-term goal
(see `README.md` roadmap) is a voice-instructed, agentic-AI puzzle game: a Vercel
serverless `api/agent` function will hold the Anthropic key and translate
natural-language commands into in-world actions. **None of that exists yet** — the
current state is a baseline walkable sandbox: one GLTF character, WASD/arrow
movement, Shift to run, a flat ground + grid, and a camera that pans along X to
follow the player.

> **Heads-up:** the repo-root `CLAUDE.md` lists `lll` under "Static, no-build"
> (inline `<script type="module">` + unpkg import map). That is **stale** — `lll`
> was migrated to a Vite + TypeScript app (commit `a32bcbc`). Treat this file as
> authoritative for `lll`; the other static Three.js projects (`toonshooter`,
> `forest-census`) still match the root description.

## Commands

Uses **pnpm** (there is a `pnpm-lock.yaml`, no `package-lock.json` — don't run `npm`).

```bash
pnpm install
pnpm dev       # Vite dev server with HMR (defaults to http://localhost:5173)
pnpm build     # `tsc` type-check (noEmit) THEN `vite build` → dist/
pnpm preview   # serve the production build
```

Visit `/` for the landing page and `/game/` for the sandbox. No test or lint
commands are configured; `pnpm build` is the only correctness gate — TypeScript
runs in `strict` mode with `noUnusedLocals`/`noUnusedParameters`, so unused
symbols fail the build.

## Build & toolchain specifics

- **Multi-page Vite build** (`vite.config.ts`): two HTML entry points — `index.html`
  (landing) and `game/index.html` (sandbox, which loads `/src/main.ts`). The bundler
  config key is `build.rolldownOptions` — this is **Vite 8 / Rolldown**, not classic
  Rollup. Use `rolldownOptions`, not `rollupOptions`, when adding inputs.
- **Three.js comes from npm** (`three@^0.184`, `@types/three`), imported as
  `import * as THREE from 'three'` and addons as `three/addons/...`. There is no CDN
  import map — do not reintroduce one.
- **`.ts` extensions in imports are intentional** (`allowImportingTsExtensions` +
  `moduleResolution: bundler`). Keep writing `./config.ts`, `./helpers.ts`, etc.
- `public/` is served at the **site root**, so the manifest and models resolve as
  `/assets.json` and `/assets/...` (not relative to `/game/`).
- Deploys to Vercel as a static site: `vercel.json` runs `pnpm build`, serves `dist/`,
  uses `cleanUrls`, and long-caches `/assets/`.

## Code architecture (`src/`)

Four modules, no framework, no scene-graph abstraction beyond Three.js itself:

- **`main.ts`** — the whole game. Sets up renderer/scene/camera, builds lights +
  ground, loads the player, wires keyboard input, and runs the `loop()` via
  `renderer.setAnimationLoop`. `bootstrap()` is the async entry; it loads the
  manifest, builds the player, then starts the clock and loop.
- **`config.ts`** — fixed render resolution (`960×540`), color palette, `PLAY_BOUNDS`
  (the X/Z box the player is clamped to), and `PLAYER_START`.
- **`manifest.ts`** — types + loading for the shared `assets.json` (the
  `forest-census` manifest format: `characters`/`animals`/`environment.{flora,resources}`).
  `loadManifest()` currently only resolves the player (`characters.Male_1`).
  `loadGltf()` caches each GLTF by key and returns a **`SkeletonUtils.clone`** so the
  same model can be instanced with independent animation state.
- **`helpers.ts`** — animation/transform utilities ported from `forest-census`. The
  `Actor` interface (an `actions` map keyed by **lowercase** clip name + the current
  action) is the shared shape for anything animated.

### Conventions worth matching

- **Animation clip lookup is case-insensitive by design.** `buildActionMap` keys
  actions by `clip.name.toLowerCase()`; `pickActionName(actions, [...candidates])`
  takes a priority-ordered list and returns the first match. This tolerates the
  Quaternius packs naming clips inconsistently (`Walk` vs `Walk_Hold`). Always go
  through `pickActionName` rather than hardcoding a clip name.
- **Ground anchoring is a two-step ritual.** `normalizeToHeightAndGround` scales a
  model to a target height and lifts it so its base sits at y=0; after the mixer's
  first `update(0)` (which poses the skeleton), `anchorMinYToGround` re-measures and
  re-anchors. Both are needed because skinned-mesh bounds are wrong until the
  skeleton is posed. Reuse this when adding any new GLTF actor.
- **Facing convention:** this asset pack visually faces **+Z** at yaw 0;
  `yawFromDirection` encodes that. `dampAngle` does shortest-arc angular damping —
  use it for smooth turning instead of lerping raw radians.
- Movement uses `THREE.MathUtils.damp` for accel/decel and a `bobTimer` sine for a
  subtle vertical bob; the camera follows by reprojecting the player to NDC and
  nudging `targetX` when it crosses an edge threshold.

## Shared skills (repo-root concern)

This project relies on the repo-root shared agent skills (`threejs-builder`, etc.),
which are **duplicated** under `.claude/skills/` and `.agents/skills/`. If you change
a shared skill, update **both** trees. See the repo-root `CLAUDE.md` for the full list.
