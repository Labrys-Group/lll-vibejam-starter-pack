# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A curated "Vibe Jam" game-dev starter pack: several **independent, standalone game projects** under `projects/` plus a bonus art-workflow folder under `bonus/`, bound together by a set of **shared agent skills** kept at the repo root. There is no root-level build, package manager, or workspace — each project is self-contained and run on its own. Always open the **repo root** (not a single project) so the shared skills are visible to the agent.

`projects/lll/` is a Three.js sandbox **forked from `forest-census`** — its long-term goal is a voice-instructed, agentic-AI-driven puzzle game (see its `README.md` roadmap; the planned `api/agent` Vercel serverless function holding the Anthropic key does not exist yet). The bonus folder `bonus/vibe-isometric-sprites/` is a prompt/reference collection, not a runnable app.

`START-HERE.md` (with `README.md`) is the human entry point: it maps each starter to the idea it fits and the skills to pair with it.

## Two project archetypes

Projects fall into one of two run models. Identify which before suggesting commands:

**1. Vite + TypeScript + Phaser 3** — `projects/oakwoods/` only. Has `package.json`/`tsconfig.json`.
```bash
cd projects/oakwoods
npm install
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # production bundle to dist/
npm run preview  # preview the production build
```
No test or lint commands are configured. Game source is real TS modules in `src/` (entry `src/main.ts`, scenes in `src/scenes/`).

**2. Static, no-build** — `tinyswords/`, `toonshooter/`, `forest-census/`, `lll/`. **No `package.json`.** The entire game lives inline in an `index.html` and is run by serving the `public/` directory statically:
```bash
cd projects/toonshooter   # or forest-census, or lll
serve public              # then open /toonshooter/  (forest-census → /forest/, lll → /game/)
# tinyswords: serve projects/tinyswords/public, or just open public/index.html
```
- `tinyswords` loads **Phaser 3 from a CDN** (`cdn.jsdelivr.net`) via a `<script>` tag.
- `toonshooter`, `forest-census`, and `lll` are **Three.js** games loaded via an `<script type="importmap">` pointing at `unpkg.com/three@0.160.0` (`three` + `three/addons/`), with all game logic in a single `<script type="module">` in `public/<game>/index.html`. The `public/index.html` at each project root is a marketing/landing page that links into `/<game>/`.
- All three Three.js projects deploy to Vercel as static sites; `vercel.json` sets `outputDirectory: public`, `cleanUrls`, and long-cache headers for `/assets/`.

## Shared skills — edit in BOTH locations

The same skills are duplicated under two trees for two different agent runtimes:
- `.claude/skills/` — consumed by Claude Code
- `.agents/skills/` — consumed by Codex/other agent tools

The skill set is: `phaser-gamedev`, `phaser4-gamedev`, `playwright-testing`, `threejs-builder`, `tinyswords-tilemap`, `threejs-capacitor-ios`, `fal-ai-image`, `retro-diffusion`. These two trees are **near-mirrors but not byte-identical** (the `.agents` copies carry a few extra reference files). When changing a shared skill, update the corresponding file under **both** `.claude/skills/<name>/` and `.agents/skills/<name>/` to keep runtimes in sync.

`threejs-capacitor-ios` is included as a reusable iOS-export workflow even though no iOS project ships in this pack.

## Cross-project pattern: manifest-driven assets

Every game loads assets through a JSON manifest rather than hardcoding paths — match this when adding assets:
- **oakwoods**: `public/assets/oakwoods/assets.json` declares spritesheets (frame size, animation frame ranges) and tilesets; `BootScene` reads it, queues loads by key, stashes the manifest in the Phaser registry, then transitions to `GameScene`.
- **toonshooter / forest-census / lll**: a top-level `public/assets.json` maps logical names → GLTF paths (characters, animals, environment); the game `fetch`es it at startup and loads models with `GLTFLoader`. `forest-census/public/ASSET_INDEX.md` documents the catalog.

Several projects ship **without their art assets** (license-restricted, e.g. the Oak Woods pack). Check the individual project's `README.md` for where to download and extract assets before assuming a missing-file error is a bug.

## Per-project docs

Each project keeps its own `README.md` (setup, asset attribution, credits), and `oakwoods` has its own detailed `CLAUDE.md` covering Phaser game config, scene flow, the player animation state machine, and infinite-world generation — read it before working in that project. `forest-census/public/forest/` also contains `PRD.md` and `TDD.md` design docs.

## Agent skills

### Issue tracker

Issues and PRDs live as markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default string names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: `CONTEXT-MAP.md` at the root indexes one `CONTEXT.md` per project under `projects/`. See `docs/agents/domain.md`.
