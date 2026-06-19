# Moleui Codebase Audit — 2026-06-19

Synthesis of a four-track deep read (desktop, Convex backend, Go, repo/branding).
Findings are de-duplicated and ranked by priority. Line numbers are indicative and
re-verified at fix time.

## Architecture at a glance

- **CLI core:** Bash `bin/` + `lib/` (cleanup engine, safety rails).
- **Go TUIs:** `cmd/analyze` (disk explorer, Trash-routed deletes), `cmd/status`
  (live dashboard). Shared `internal/units`.
- **Desktop:** `apps/desktop` — Electron main (`main.js`) + preload + React/Vite
  renderer. Talks to Convex; Clerk in renderer; Stripe via a sandboxed window.
- **Backend:** `convex/` — `auth.config.ts` (Clerk JWT), `billing.ts` (checkout/
  portal actions), `stripeWebhook.ts` (+ `http.ts`), `subscriptions.ts`, `users.ts`.
- **Web/dist:** `apps/web` (Next.js landing), `packages/npm` (launcher).
- **Mode:** Clerk `pk_test` (test mode); Stripe test-mode helper present. Convex
  client points at `effervescent-sturgeon-55`.

## Priority-ranked findings

### P0 — Revenue / security (do first)

- **Country-price arbitrage.** `convex/billing.ts` selects BRL vs USD price from a
  **client-supplied `country`**. A non-BR user can pass `country: "BR"` and pay the
  cheaper BRL price. Stripe does not force currency to match the billing address.
  Fix: derive/validate country server-side (trusted source), or reconcile against
  the Stripe-collected address; never trust the client value for pricing.
- **Paywall is client-side only.** All `requireSubscription(...)` checks live in the
  renderer; the `main.js` IPC handlers (`clean/optimize/analyze/uninstall execute`)
  have **no entitlement gate**. Anyone who opens DevTools can call them directly, or
  set `localStorage['moleui:developer-unlocked'] = 'true'` to flip `isSubscribed`.
  Reality: a local Electron app can never be fully tamper-proof, but the trivial
  holes should close (guard the dev-unlock to dev builds, verify entitlement at the
  IPC boundary, document the trust model). `useSubscription.tsx`, `main.js`.

### P1 — Correctness / safety

- **Go silent-delete path (SAFETY).** `cmd/analyze/update.go` sets
  `deleteConfirm = true` for multi-select even when `deleteTarget` is nil; `view.go`
  then renders no confirmation, yet Enter proceeds to delete. A stale multiselect
  after a rescan can delete without a visible confirm. Must guard.
- **Install/update attestation owner.** `install.sh` verifies release attestation
  with `--owner tw93`. Once releases come from `stwgabriel/moleui`, verification
  fails and **installs/updates break**. (Also a WS1 item.)
- **No `invoice.payment_failed` handling.** `convex/stripeWebhook.ts` handles
  subscription create/update/delete + checkout.completed, but a failed renewal
  leaves `status: active` through Stripe's multi-day retry window, so a lapsed user
  keeps premium access until final cancellation.
- **Silent drop on unknown customer.** `convex/subscriptions.ts upsertFromStripe`
  returns early if no user matches `stripeCustomerId`, with no log/observability —
  webhook events can be lost silently.
- **Entitlement not live.** `useSubscription.tsx` uses a one-shot `convex.query`
  refreshed only on sign-in / billing-window close, so subscription changes made
  elsewhere don't reflect until restart. Prefer reactive `useQuery`.

### P2 — Quality / cleanup

Desktop:
- Dead code: `HomePage.tsx`, `SmartCarePage.tsx`, and unused `storage.ts` helpers
  (`hasSeenHomePage`, `markHomePageSeen`, `getPreferredPage`, `setPreferredPage`);
  stale `'home'` member in `PageId`.
- `(window as any).Clerk` access in `SettingsWindow.tsx` / `UserAvatar.tsx` is
  fragile; sign-out is non-atomic and unguarded. Prefer `useClerk()`.
- No `setWindowOpenHandler` on main/login/settings windows (only billing).
- `any` types: entitlement state, `ProcessDonutIconLabel`, some `moleDesktop` casts
  in `UninstallPage.tsx`.

Go:
- `*.egg-info` fold key never matches (exact-map lookup vs suffix) — `constants.go`.
- `insights.go getDirSizeFast` runs `du` without `validatePath` (defense-in-depth).
- O(n^2) selected-size recompute on every space/keypress (`update.go`, `view.go`).
- `scanSubdirWithCache` is dead; `calculateDirSizeFast` is test-only (verify before
  removing per the test-orphan rule).
- Minor: redundant percent clamp, discarded open/preview errors.

### P3 — Branding / reorg (WS1 + WS2)

- Live `tw93` coupling: `.github/workflows/release.yml` (homebrew-core PR step,
  release link), `.github/ISSUE_TEMPLATE/config.yml` (security email),
  `.github/FUNDING.yml`, `install.sh` (attestation owner),
  `scripts/update_homebrew_tap_formula.sh` (regex), `scripts/setup-quick-launchers.sh`
  (`fun.tw93.mole` bundle id), `.claude/hooks/format-on-edit.sh` (goimports -local),
  `.claude/skills/release-notes/*`, `AGENTS.md` release docs, `.kiro/steering/
  structure.md` + `agents/structure.md` (stale Go import).
- Naming split: "Mole" (agent docs, CONTRIBUTING, Makefile, CLI binary) vs "Moleui"
  (README, desktop, npm, go.mod). Binary stays `mole`/`mo`; product is Moleui.
- `agents/` duplicates `.kiro/steering/`; pick one source of truth.

## Verified-good (no action)

- Stripe webhook signature verification is present and correct (`stripeWebhook.ts`).
- `cmd/analyze` deletes route through Finder/Trash with double path validation and
  OrbStack protection.
- Billing window URL allowlist (`checkout|billing.stripe.com`) is correctly tight.
- `go test ./...`: 595 tests pass; `go vet` clean.
- LICENSE already re-attributed to stwgabriel.

## Suggested execution order

WS3 (P0/P1 revenue+security) -> WS5 (P1 Go safety) -> WS1 (P1 install break +
branding) -> WS4 (desktop quality) -> WS2 (reorg) -> WS6 (final report). WS1/WS2
scope depends on owner decisions captured in `specs/README.md`.
