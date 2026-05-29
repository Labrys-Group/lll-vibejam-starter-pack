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

## Project Layout

```
public/
├─ index.html          # Landing page → /game
├─ assets.json         # Asset manifest (shared with forest-census format)
├─ assets/             # Quaternius GLTF models
└─ game/
   └─ index.html       # Three.js sandbox (all game logic inline)
vercel.json            # Static hosting config (clean URLs, asset caching)
```

## Running Locally

```bash
npm install -g serve   # or use npx serve
serve public
```

Then visit:
- `http://localhost:3000/` — landing page
- `http://localhost:3000/game/` — sandbox

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
