# WS3 — Stories

## S1 — Failed payments revoke access promptly
As the business, when a subscriber's renewal payment fails, their access should
reflect the lapse without waiting for Stripe to exhaust retries.
**Done when:** the webhook handles `invoice.payment_failed` and `invoice.paid`,
retrieving and upserting the subscription so `status` tracks Stripe.

## S2 — Dev-unlock cannot bypass the paywall in production
As the business, the developer "unlock without paying" path must not be reachable
by end users.
**Done when:** packaged builds run with `devTools` disabled; the renderer clears a
stale `developer-unlocked` flag when `getRuntimeInfo().packaged` is true; the
unlock menu remains dev-only.

## S3 — Pricing country has one trusted source + observability
As the business, a user should not pick their own discounted price.
**Done when:** checkout derives the price from a single server-side field
(`user.country`), the per-call `country` arg is removed, the value is ISO-validated,
and selecting discounted pricing logs an anomaly line. The full fix (Stripe
Adaptive Pricing) is documented and a migration script is provided.

## S4 — Webhook anomalies are observable
As an operator, I should see when a webhook references an unknown Stripe customer.
**Done when:** `upsertFromStripe` logs a warning (customer id + event context)
before returning on no-match.

## S5 — Subscription state is live
As a user, after subscribing or after a change elsewhere, the app reflects it
without a restart.
**Done when:** entitlement uses Convex `useQuery` (reactive); dev-unlock and
signed-out states still resolve correctly.

## S6 — Auth + payment verified end to end
As the owner, login/auth/payment should be proven to work.
**Done when:** Convex typechecks, the desktop builds, and a Stripe TEST checkout
flow is exercised with `moleui@stwgabriel.com` (test card `4242…`) and the result
is reported, including anything that could not be driven headlessly.
