# Auth, Billing, and Convex Setup

This app uses Clerk for authentication, Convex for account/subscription API state, and Stripe for subscriptions.

## Client Environment

Create `apps/desktop/.env.local` from `apps/desktop/.env.example`:

```bash
VITE_CLERK_PUBLISHABLE_KEY=...
VITE_CONVEX_URL=...
```

These values are public client configuration. Do not put Clerk secret keys or Stripe secret keys in the desktop app.

## Convex Environment

Set these in Convex, not in source code:

```bash
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain.clerk.accounts.dev
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_BRL_MONTHLY=...
STRIPE_PRICE_USD_MONTHLY=...
STRIPE_CHECKOUT_COUPON_ID=
STRIPE_CHECKOUT_PROMOTION_CODE_ID=
STRIPE_CHECKOUT_PROMOTION_CODE=
APP_CHECKOUT_SUCCESS_URL=https://billing.moleui.local/success
APP_CHECKOUT_CANCEL_URL=https://billing.moleui.local/cancel
APP_BILLING_RETURN_URL=https://billing.moleui.local/return
```

The checkout action accepts one optional automatic discount. Configure only one of:

- `STRIPE_CHECKOUT_COUPON_ID`, for a Stripe coupon ID such as `moleui_100_off_test`.
- `STRIPE_CHECKOUT_PROMOTION_CODE_ID`, for a Stripe promotion-code ID such as `promo_...`.
- `STRIPE_CHECKOUT_PROMOTION_CODE`, for an active code such as `MOLEUI100`.

If none are set, Checkout allows customers to enter promotion codes manually.

## Stripe Products

Create one product named `Moleui Pro` with two monthly recurring prices:

```text
Brazil: BRL 15/month
Rest of world: USD 5/month
```

Set the resulting price IDs in Convex as `STRIPE_PRICE_BRL_MONTHLY` and `STRIPE_PRICE_USD_MONTHLY`.

## 100% Test Coupon

For login and checkout testing, create a 100% off test coupon and promotion code:

```bash
STRIPE_SECRET_KEY=sk_test_... bun run stripe:create-test-coupon
```

The default code is `MOLEUI100`, backed by coupon ID `moleui_100_off_test`. The script prints the Stripe promotion-code ID. To apply the discount automatically in the desktop checkout, set this Convex env:

```bash
STRIPE_CHECKOUT_PROMOTION_CODE_ID=promo_...
```

Leave the discount env unset if you want the Stripe checkout screen to show the promotion-code entry field instead.

## Webhook

Point Stripe to the Convex HTTP endpoint:

```text
https://<your-convex-deployment>.convex.site/stripe-webhook
```

Subscribe to these events:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

## Clerk

Enable email-link or email/password sign-in in Clerk. Add a Clerk JWT template for Convex with audience/application ID `convex`, then set `CLERK_JWT_ISSUER_DOMAIN` in Convex.

## Project Creation

Project creation still requires account authentication in your browser/CLI sessions. After logging in locally, use:

```bash
rtk bunx convex dev
```

Stripe and Clerk product/app creation can be done from their dashboards, then the IDs above can be copied into Convex and `apps/desktop/.env.local`.
