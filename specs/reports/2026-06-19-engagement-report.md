# Moleui Overhaul — Engagement Report (2026-06-19)

After-action report for the desktop-first overhaul. Companion to the
[codebase audit](codebase-audit-2026-06-19.md) and [CHARTER](../CHARTER.md).

## Summary

Took Moleui from "forked + partially rebranded WIP" to an independent,
desktop-first project with hardened auth/payment and Go code, on a clean branch
with organized history. Work was driven through six spec-driven workstreams under
`specs/`. Branch: `moleui/overhaul` (off `main`). Nothing was pushed.

## Status

| WS | Outcome | State |
|----|---------|-------|
| WS1 Detach & Rebrand | `upstream` remote removed; tw93 coupling stripped from install/release/tooling/docs/CLI-tests; legit refs preserved | Done |
| WS3 Auth & Payment | country-price arbitrage hardened (+ Adaptive Pricing migration), failed-payment handling, observability, reactive entitlement, dev-unlock lockdown | Code done + verified; **live test pending 2FA code** |
| WS5 Go Fixes | silent-delete confirmation guard (safety), egg-info fold bug, du path-validation, dead-code removal; safety-reviewed | Done |
| WS4 Desktop Quality | dead pages/helpers removed, Clerk via hooks, atomic sign-out, child-window hardening | Done |
| WS2 Repo Reorg | clarity layer (ARCHITECTURE.md + diagram, steering fix, README confirmed desktop-first); physical restructure planned + gated | Stage 1 done; Stage 2 gated |
| WS6 Report | this document + visual summary | Done |

## What changed (highlights)

### Auth & payment (WS3)
- **Country-price arbitrage**: checkout no longer accepts a client `country`;
  pricing derives from the server-stored country and is ISO-validated, with an
  anomaly log. Full closure path shipped: `scripts/configure_adaptive_pricing.mjs`
  builds a single multi-currency Stripe Price (set `STRIPE_PRICE_ID` to enable;
  Stripe then geolocates at checkout — no client trust).
- **Failed payments**: webhook now handles `invoice.payment_failed` + `invoice.paid`
  (and reads `current_period_end` defensively across Stripe API versions).
- **Observability**: `upsertFromStripe` logs when a webhook references an unknown
  Stripe customer instead of dropping silently.
- **Reactive entitlement**: `useSubscription` uses Convex `useQuery` (live updates).
- **Dev-unlock lockdown**: `devTools` disabled in packaged builds; the renderer
  clears a stale `developer-unlocked` flag when `packaged`.

### Go (WS5)
- The analyze delete confirmation now always renders when delete mode is active and
  there is a target or multi-selection (a stale multi-select could previously enter
  delete mode with no visible prompt). Trash routing and protected-path checks
  unchanged. Safety-reviewer verdict: safe to merge.
- `*.egg-info` directories now fold during scan (was a never-matching map key) — new
  regression test. `getDirSizeFast` validates its path before `du`. Dead
  `scanSubdirWithCache` removed.

### Desktop (WS4)
- Removed `HomePage`, `SmartCarePage`, four unused `storage.ts` helpers, and the
  stale `'home'` `PageId`. `UserAvatar`/`SettingsWindow` read the user via
  `useUser()`; sign-out via `useClerk().signOut()` in try/finally. `denyChildWindows`
  on main/settings/CLI windows (login excluded for Clerk popups).

### Detach (WS1)
- Removed the `upstream` remote. `install.sh` attestation owner -> `stwgabriel`.
  Removed the upstream Homebrew-core PR step from `release.yml` (kept the personal
  tap). Repointed format hook, release-notes skill, AGENTS docs, homebrew tap
  generator, funding/issue config, and quick-launcher bundle id to the owner.
  Preserved `com.tw93.MiaoYan` cleanup, example paths, and `CONTRIBUTORS.svg`.

### Reorg (WS2)
- Added `docs/ARCHITECTURE.md` (Mermaid diagram + component map + flows). README was
  already desktop-first. Documented agent-context source of truth. Stage-2 physical
  move is planned and gated (see WS2 PRD).

## Verification

| Check | Result |
|-------|--------|
| `go test ./...` | 596 passed (3 packages) |
| `go vet ./cmd/analyze` | clean |
| Convex `tsc --noEmit` | clean |
| Desktop `tsc --noEmit` | clean |
| Desktop `bun run build` | success |
| `main.js` `node --check` | OK |
| Shell `bash -n` (changed files) | OK |
| `release.yml` YAML parse | OK |
| Safety review (analyze delete path) | safe to merge |
| Auth E2E (Clerk test mode) | password accepted (`needs_second_factor`) — login verified |

## Payment test status (the one open item)

Login + auth were verified headlessly: Clerk accepted the password for
`moleui@stwgabriel.com` and advanced to the second factor, which is an **email
code** to that address. Headless completion is blocked there. The remaining live
steps (mint Convex JWT -> `entitlement` query -> `createCheckoutSession` -> Stripe
test checkout URL) are verified at the code/type/build level but not exercised live.

To finish the live test: provide a fresh Clerk email code (I re-trigger it; valid
~10 min) and I complete the flow, or temporarily disable 2FA on the test account.
Note the live run hits the **deployed** backend; the WS3 backend changes are
typechecked but not yet deployed.

## Residual risks & recommendations

1. **Deploy the WS3 backend changes** to Convex (owner-gated): `npx convex deploy`
   (or `dev`) for the chosen deployment. They are typechecked, not deployed.
2. **Enable Adaptive Pricing** to fully close country arbitrage: run
   `scripts/configure_adaptive_pricing.mjs --apply` (needs `STRIPE_SECRET_KEY`),
   then `npx convex env set STRIPE_PRICE_ID <id>`.
3. **Bats suite not runnable here** (`bats` not installed): shell changes were
   `bash -n`-checked and the stale CLI tests were aligned, but the Bats suite must
   be confirmed green in CI.
4. **Stage-2 physical restructure** is planned + gated; execute in a CI-verified PR.
5. **Deferred type cleanups**: `ProcessDonutIconLabel` (MyMacPage) and a few
   `window.moleDesktop as any` casts in `UninstallPage`.
6. **Bundle size**: desktop main chunk > 500 kB (pre-existing); consider code-split.

## Overhaul commits (on `moleui/overhaul`, after the WIP checkpoint on `main`)

```
feat(billing): harden checkout pricing, failed-payment handling, live entitlement, dev-unlock lockdown
fix(analyze): always confirm before delete, fold egg-info dirs, validate du path, drop dead wrapper
chore(detach): remove tw93 coupling from install, release, tooling, docs, and CLI tests
feat(desktop): remove dead pages/helpers, use Clerk hooks, atomic sign-out, harden child windows
docs(arch): add desktop-first ARCHITECTURE.md with diagram; fix stale steering import
+ per-workstream spec commits and corrections
```

The pre-existing 176-file WIP was first committed to `main` in 10 organized,
subsystem-grouped commits (with a CHANGELOG entry) before this work began.
