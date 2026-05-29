# LLL

> Part of the [Vibe Jam Starter Pack](../../README.md).

A 3D sandbox game (forked from `forest-census`) where the long-term goal is to
**instruct a character by voice to solve puzzles**, with an **agentic AI brain**
that interprets natural-language commands and drives the character's in-world
actions.

## Status

**Baseline scaffold.** Currently a walkable sandbox only:
- Three.js scene, ground + grid, lighting, fixed panning camera.
- One GLTF player character (`Character_Male_1`) with idle/walk/run animation.
- WASD / arrow-key movement, `Shift` to run.

The voice input and Claude-powered serverless agent are the next iterations
(see roadmap below).

## Tech Stack

[Vite](https://vite.dev) + TypeScript, with [three.js](https://threejs.org)
installed from npm (no CDN import maps). Two-page build: a landing page at `/`
and the sandbox at `/game/`.

## Project Layout

```
index.html             # Landing page → /game
game/
└─ index.html          # Sandbox shell (loads /src/main.ts)
src/
├─ config.ts           # Palette, play bounds, canvas dimensions
├─ manifest.ts         # Asset manifest types + GLTF loading
├─ helpers.ts          # Animation + transform helpers
└─ main.ts             # Scene, player, input, camera, render loop
public/
├─ assets.json         # Asset manifest (shared with forest-census format)
└─ assets/             # Quaternius GLTF models (served at /assets/)
vite.config.ts         # Multi-page build config
vercel.json            # Static hosting config (clean URLs, asset caching)
```

## Running Locally

Uses [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev       # Vite dev server with HMR
pnpm build     # type-check + production bundle to dist/
pnpm preview   # preview the production build
```

The dev server prints its URL (defaults to `http://localhost:5173`). Visit:
- `/` — landing page
- `/game/` — sandbox

## Roadmap

1. **Baseline sandbox** ✅ — walkable character in a 3D scene.
2. **Agentic brain** — Vercel serverless function (`api/agent`) holding the
   Anthropic API key server-side; translates natural language into a sequence
   of in-world actions the character executes.
3. **Voice input** — speech-to-text feeding the agent.
4. **Puzzle layer** — objects, goals, and win conditions to solve by instruction.

## Asset Attribution

Low-poly 3D assets associated with [Quaternius](https://quaternius.com/). Check
the original pack pages for license terms before redistributing.
