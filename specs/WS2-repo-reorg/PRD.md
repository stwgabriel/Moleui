# WS2 — Repo Reorg (PRD)

## Problem

The owner asked to "reorganize to a more visual way" and reframe the repo around
its new identity as **primarily a desktop app**, staged: a clarity layer first,
then a verified physical restructure.

## Findings

- `README.md` is **already desktop-first** and fully rebranded (no change needed).
- There was no single architecture overview or diagram.
- `.kiro/steering/structure.md` carried a stale upstream Go import example.
- The `agents/` directory is **gitignored and untracked** (`.gitignore:/agents`) —
  a local mirror of `.kiro/steering/`, not part of the repo, so there is no
  committed duplication to remove.

## Goals

- **Stage 1 (clarity, now):** make the repo navigable and visual without risky
  moves — an architecture doc + diagram, accurate steering docs, a documented
  single source of truth for agent context.
- **Stage 2 (physical restructure, planned + gated):** an engine/apps split, done
  in one CI-verified PR (see plan below).

## Non-goals (this stage)

- Moving top-level directories now. The move touches `go.mod` import paths, the
  `mole`/`mo` shims, `install.sh`, `Makefile`, `turbo.json`, electron-builder
  `extraResources` (`.mole-runtime`), and every Bats test that references
  `bin/`/`lib/` paths. The Bats suite cannot run in this environment (`bats` is not
  installed), so a large move cannot be verified locally — it must land in a PR
  where CI runs the full suite.

## Stage 2 plan (proposal, gated on approval + green CI)

Target layout for desktop-first clarity (one option):

```
apps/{desktop,web}      # the product surfaces
packages/npm            # launcher
backend/                # convex/ (renamed)
engine/                 # bin/ lib/ cmd/ internal/  (the CLI/TUI engine)
```

Required, in one PR, verified by `./scripts/test.sh` (Bats) + `go test ./...` +
`bun run desktop:build` + an `install.sh` dry-run, all green in CI:
1. Move dirs; update `go.mod`-relative import paths for `cmd/`, `internal/`.
2. Update `mole`/`mo` relative `lib/` sourcing and `install.sh` copy paths.
3. Update `Makefile` build targets, `turbo.json`, electron-builder
   `extraResources` for the bundled runtime.
4. Update Bats path references and `scripts/*`.

Recommendation: the current monorepo layout is already reasonable; weigh the churn
against the benefit before executing Stage 2. The ARCHITECTURE doc delivers most of
the navigability benefit now.

## Success criteria (Stage 1)

- `docs/ARCHITECTURE.md` exists with a diagram and a directory map.
- Steering docs are accurate (stale import fixed).
- Agent-context source of truth is documented (`.kiro/steering/` + `AGENTS.md`).
