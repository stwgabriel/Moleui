# WS3 — Auth & Payment Hardening (PRD)

## Problem

Clerk (auth) + Stripe-via-Convex (billing) power the desktop paywall. The audit
([../reports/codebase-audit-2026-06-19.md](../reports/codebase-audit-2026-06-19.md))
found:

1. **Country-price arbitrage** — checkout price is chosen from a client-supplied
   country, so a non-BR user can obtain the cheaper BRL price.
2. **Dev-unlock bypass** — `localStorage['moleui:developer-unlocked']` flips
   `isSubscribed`; settable via DevTools, which are enabled in production builds.
3. **No failed-payment handling** — `invoice.payment_failed` is not handled, so a
   lapsed subscriber keeps access through Stripe's multi-day retry window.
4. **Silent webhook drops** — `upsertFromStripe` returns silently when no user
   matches the Stripe customer; no observability.
5. **Non-reactive entitlement** — a one-shot `convex.query` only refreshes on
   sign-in / billing-window close, so changes elsewhere don't reflect live.

## Goals

- Close the trivial revenue/security holes **without breaking Brazil (BRL)
  pricing** (a likely primary market).
- Reflect payment failures and live subscription changes in the UI.
- Add observability for webhook anomalies.
- Verify login -> auth -> Stripe TEST checkout end to end.

## Non-goals

- Full tamper-proofing of a local Electron app (impossible; the paywall is a
  client gate by nature — documented as a known limitation).
- Reconfiguring the live Stripe account from this repo. Instead: document and
  script the proper fix (Stripe Adaptive Pricing / multi-currency price).

## Success criteria

- `invoice.payment_failed` and `invoice.paid` handled; status reflects lapses.
- Production builds ship with `devTools` disabled; a stale dev-unlock flag is
  cleared when the app is packaged.
- Entitlement is reactive via `useQuery`.
- Pricing country has a single source of truth + an anomaly log; Adaptive Pricing
  is documented with a runnable migration script.
- `convex` typecheck and desktop `tsc && vite build` are green.
- End-to-end checkout attempted in test mode and reported honestly.
