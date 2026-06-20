# WS2 — Stories

## S1 — A navigable, visual architecture overview
As a new contributor, I can understand the system at a glance.
**Done when:** `docs/ARCHITECTURE.md` exists with a Mermaid diagram (desktop ->
Clerk/Convex/Stripe + spawned mole engine) and a directory map.

## S2 — One source of truth for agent context
**Done when:** docs state that `.kiro/steering/` (committed) + `AGENTS.md` are
canonical, and that `agents/` is a gitignored local mirror (not in the repo).

## S3 — Steering docs are accurate
**Done when:** the stale `github.com/tw93/mole/internal/pkg` import example in
`.kiro/steering/structure.md` is corrected to `github.com/stwgabriel/moleui/...`.

## S4 — Physical restructure is planned and gated
As the owner, I want the engine/apps split sequenced safely.
**Done when:** the PRD documents the target layout, the exact touch points, and the
CI-green verification gate (Bats cannot run locally), so Stage 2 can be executed in
a dedicated PR on approval.
