# Moleui Engagement Charter

> This file is the rewritten, self-steering version of the original request. It is
> the north star for the whole effort. Every workstream below traces back to it.

## Original request (verbatim, for traceability)

> "go over my project, understand the codebase, detach from upstream, re organize
> to a more visually way, look up into my desktop and go code, optimize, look at
> possible issues, create a report, test the login, auth and payment, do what you
> need to to to improve, for each thing you work on use spec driven development so
> prd stories task track and what else you need ... i need a plan, set everything
> for me and dont stop until you made it all, start by rewriting this prompt to
> better self steer and go to work"

## Mission

Take **Moleui** (a commercial macOS GUI built on a fork of `tw93/Mole`) from
"forked and partially rebranded" to **independent, well-organized, hardened, and
verified**, driving every change through spec-driven development.

## What Moleui is (one paragraph)

A macOS cleanup/optimize/uninstall/analyze tool. Core engine is Bash (`bin/`,
`lib/`) plus two Go TUIs (`cmd/analyze`, `cmd/status`). The commercial layer is an
Electron + React desktop app (`apps/desktop`) gated by a subscription, with a
Convex backend (`convex/`), Clerk for auth, and Stripe for billing. A thin Next.js
site (`apps/web`) and an npm launcher (`packages/npm`) round it out. Monorepo via
Turbo + Bun.

## Operating principles (self-steering rules)

1. **Spec-first.** Every workstream gets `PRD.md` -> `STORIES.md` -> `TASKS.md`
   under `specs/<WSx-slug>/`, tracked to done in `specs/README.md`.
2. **Safety-first.** This product deletes user files. Never bypass `mole_delete`,
   Trash routing, or `should_protect_path`. Run shell with `MOLE_TEST_NO_AUTH=1`
   and destructive flows with `MOLE_DRY_RUN=1`. Destructive sinks get
   line-by-line review (see AGENTS.md).
3. **Verify everything.** Shell: `./scripts/check.sh --format` + relevant bats.
   Go: `go test ./...`. Desktop: `tsc && vite build` + a live run. Payment: Stripe
   TEST mode, end to end, with test cards (no real charges).
4. **Reversible by default.** Branch per workstream. No git history rewrite, no
   force-push, no destructive git op without explicit owner approval. Secrets are
   never printed or committed.
5. **Don't stop.** Execute the plan to completion. Pause only for genuinely
   irreversible or ambiguous forks, and prefer a sensible default with a note.

## Workstreams

| ID  | Name                         | Outcome |
|-----|------------------------------|---------|
| WS1 | Detach & Rebrand             | No live coupling to `tw93`; consistent product identity; releases/installs verify against own repo. |
| WS2 | Repo Reorg                   | Cleaner top level, deduped agent/spec dirs, dead code removed, navigable docs. |
| WS3 | Auth & Payment Hardening     | Country-price arbitrage closed, dev-unlock bypass guarded, failed-payment handling, live entitlement, end-to-end tested. |
| WS4 | Desktop Quality              | Dead pages removed, Clerk access typed/atomic, window hardening, type-safety gaps closed. |
| WS5 | Go Optimize & Fix            | Silent-delete guard, fold bug, path-validation gap, O(n^2) hot path, dead code. |
| WS6 | Consolidated Report          | Single audit + before/after, shipped to owner. |

## Owner decisions (2026-06-19)

- **Detach:** remove the `upstream` git remote; keep full commit history (no squash).
- **Dead code:** remove unused code repo-wide, verified per the test-orphan rule in
  AGENTS.md before each removal.
- **Strategic framing:** Moleui's primary product is now the **desktop app**. The
  Bash CLI and Go TUIs are the engine behind it; reorg, docs, and naming are
  desktop-first.
- **Reorg:** staged. Clarity layer first (dedupe `agents/` vs `.kiro/`, remove dead
  code, add architecture docs/diagram, unify naming), then a verified physical
  restructure.

## Definition of done

- All six specs closed in `specs/README.md`.
- `./scripts/check.sh --format`, full bats suite, and `go test ./...` green.
- Desktop builds and launches; login + entitlement + a Stripe TEST checkout verified.
- No `tw93` live coupling remains; identity consistent.
- Audit report delivered.
