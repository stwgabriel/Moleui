# WS3 — Tasks

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

## Code
- [x] T1 (S1) `convex/stripeWebhook.ts`: handle `invoice.payment_failed` +
  `invoice.paid`; defensive `current_period_end` (subscription or item).
- [x] T2 (S4) `convex/subscriptions.ts`: warn before returning on unknown customer.
- [x] T3 (S3) `convex/billing.ts`: drop client `country` arg; derive from
  `user.country`; ISO-validate; log discounted-pricing selection; add
  `STRIPE_PRICE_ID` Adaptive Pricing path.
- [x] T4 (S3) `useSubscription.tsx`: call `createCheckoutSession({})`.
- [x] T5 (S5) `useSubscription.tsx`: entitlement via reactive `useQuery`.
- [x] T6 (S2) `useSubscription.tsx`: clear stale dev-unlock when packaged.
- [x] T7 (S2) `apps/desktop/main.js`: `devTools: isDev` on all app + billing windows.
- [x] T8 (S3) `scripts/configure_adaptive_pricing.mjs`: multi-currency migration.

## Verify
- [x] V1 `apps/desktop` `tsc --noEmit` green.
- [x] V2 Convex `tsc -p convex/tsconfig.json --noEmit` green.
- [x] V3 `apps/desktop` `bun run build` green.
- [~] V4 (S6) End-to-end (test mode, headless, no GUI):
  - [x] Clerk dev-browser + password sign-in: **password accepted**
    (`needs_second_factor`) — login credentials verified.
  - [x] Second factor identified: `email_code` to `moleui@stwgabriel.com`.
  - [~] Email code triggered; awaiting code to finish session -> Convex JWT ->
    `entitlement` query -> `createCheckoutSession` (test-mode Stripe URL).
  - Note: the live run hits the **deployed** backend; the WS3 backend changes are
    typechecked but not yet deployed (deploy is a separate, owner-gated step).

## Docs
- [ ] D1 Update `docs/auth-billing-setup.md` (Adaptive Pricing + new webhook events).
- [ ] D2 Record residual risks in the WS6 report.
