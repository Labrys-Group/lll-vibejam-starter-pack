# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **multi-context**: a `CONTEXT-MAP.md` at the root points to one `CONTEXT.md` per project under `projects/`. Each project is self-contained, so its domain language lives with it.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it lists each project and the path to its `CONTEXT.md`. Read the map first to find the right context for the project you're working in.
- **The relevant project's `CONTEXT.md`** (e.g. `projects/lll/CONTEXT.md`) — read the one(s) covering the project/topic at hand, not all of them.
- **`docs/adr/`** at the repo root — system-wide / cross-project decisions. Also check `projects/<name>/docs/adr/` for decisions scoped to a single project.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved. Not every project has a `CONTEXT.md` yet — that's expected.

## File structure

```
/
├── CONTEXT-MAP.md                    ← index of per-project contexts
├── docs/adr/                         ← system-wide / cross-project decisions
└── projects/
    ├── lll/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← project-scoped decisions (lazily created)
    ├── forest-census/
    │   └── CONTEXT.md
    └── …
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in that project's `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids. Terms can differ between projects — use the vocabulary of the project you're in.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
