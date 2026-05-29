# Context Map

This repo is a **multi-project starter pack**. Each project under `projects/` is
self-contained and carries its own domain language. This map points at each
project's `CONTEXT.md` (the domain glossary). Read the map first, then the
relevant project's context.

A missing `CONTEXT.md` is expected — most projects don't have one yet. They're
created lazily by `/grill-with-docs` as domain terms get resolved. See
`docs/agents/domain.md` for the consumer rules.

## Projects

| Project          | Path                              | Context                                  | What it is                                                                 |
| ---------------- | --------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| `lll`            | `projects/lll/`                   | [`projects/lll/CONTEXT.md`](projects/lll/CONTEXT.md) | Three.js 3D sandbox (forked from `forest-census`); planned voice/agentic puzzle game. |
| `forest-census`  | `projects/forest-census/`         | _none yet_                               | Three.js timed game — count the yellow chicks in a voxel forest.           |
| `toonshooter`    | `projects/toonshooter/`           | _none yet_                               | Three.js quick-action toon shooter prototype.                              |
| `tinyswords`     | `projects/tinyswords/`            | _none yet_                               | Phaser 3 (CDN) 2D strategy duel prototype ("Castle Clash Duel").           |
| `oakwoods`       | `projects/oakwoods/`              | _none yet_                               | Vite + TypeScript + Phaser 3 platformer ("Oak Woods").                     |

`bonus/vibe-isometric-sprites/` is a prompt/reference collection, not a runnable
project, and has no context.

## System-wide decisions

Cross-project architectural decisions live in `docs/adr/` at the repo root.
Project-scoped decisions live in `projects/<name>/docs/adr/`.
