# Moleui Specs

Spec-driven development home. Start at [CHARTER.md](CHARTER.md).

## How this works

Each workstream lives in `specs/<WSx-slug>/` with three files:

- **PRD.md** — problem, goals, non-goals, scope, success criteria.
- **STORIES.md** — stories with acceptance criteria (the "what" and "done when").
- **TASKS.md** — ordered, checkable tasks (the "how"), each with a status box.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked.

## Status board

| Workstream | Spec | Status | Notes |
|------------|------|--------|-------|
| WS1 Detach & Rebrand        | `WS1-detach-rebrand/`   | Done | remote removed; tw93 coupling stripped (legit refs preserved) |
| WS2 Repo Reorg              | `WS2-repo-reorg/`       | Stage 1 done | clarity (ARCHITECTURE.md + diagram); Stage 2 restructure planned + gated |
| WS3 Auth & Payment          | `WS3-auth-payment/`     | In progress | code done + verified (typecheck/build); live test pending 2FA code |
| WS4 Desktop Quality         | `WS4-desktop-quality/`  | Done | dead code removed; Clerk hooks; atomic sign-out; window hardening |
| WS5 Go Optimize & Fix       | `WS5-go-optimize/`      | Done | silent-delete guard, egg-info fold, du validation; safety-reviewed |
| WS6 Consolidated Report     | `reports/`              | Done | audit + engagement report + visual summary |

## Reports

- [reports/codebase-audit-2026-06-19.md](reports/codebase-audit-2026-06-19.md) — full findings.
- [reports/2026-06-19-engagement-report.md](reports/2026-06-19-engagement-report.md) — after-action report (what shipped, verification, residuals).
