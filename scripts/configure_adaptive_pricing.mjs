#!/usr/bin/env node
// Configure Stripe Adaptive Pricing (a single multi-currency Price) for Moleui.
//
// Why: the desktop client currently influences which per-country Price is used at
// checkout, which allows country-price arbitrage (see specs/WS3-auth-payment).
// A single multi-currency Price lets Stripe choose the currency from the
// customer's Stripe-verified location at checkout, removing client control.
//
// What it does: reads the existing USD and BRL monthly prices and builds one new
// Price (base currency USD) with a BRL `currency_options` entry, on the same
// product. After creating it, set STRIPE_PRICE_ID in the Convex environment to
// the printed id; convex/billing.ts then uses it automatically.
//
// Usage (dry run prints the plan; --apply creates the price):
//   STRIPE_SECRET_KEY=sk_test_... \
//   STRIPE_PRICE_USD_MONTHLY=price_... \
//   STRIPE_PRICE_BRL_MONTHLY=price_... \
//   node scripts/configure_adaptive_pricing.mjs [--apply]

import Stripe from 'stripe';

function hasFlag(name) {
  return process.argv.includes(name);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

function productId(price) {
  return typeof price.product === 'string' ? price.product : price.product.id;
}

async function main() {
  const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
  const usdPriceId = requireEnv('STRIPE_PRICE_USD_MONTHLY');
  const brlPriceId = requireEnv('STRIPE_PRICE_BRL_MONTHLY');
  const apply = hasFlag('--apply');

  const [usd, brl] = await Promise.all([
    stripe.prices.retrieve(usdPriceId),
    stripe.prices.retrieve(brlPriceId),
  ]);

  if (usd.currency !== 'usd') throw new Error(`Expected ${usdPriceId} to be USD, got ${usd.currency}`);
  if (brl.currency !== 'brl') throw new Error(`Expected ${brlPriceId} to be BRL, got ${brl.currency}`);
  if (!usd.recurring || !brl.recurring) throw new Error('Both prices must be recurring (subscription) prices');
  if (usd.unit_amount == null || brl.unit_amount == null) throw new Error('Both prices must have a fixed unit_amount');
  if (productId(usd) !== productId(brl)) {
    console.warn(`Note: USD and BRL prices use different products (${productId(usd)} vs ${productId(brl)}); using the USD product.`);
  }

  const params = {
    product: productId(usd),
    currency: 'usd',
    unit_amount: usd.unit_amount,
    recurring: {
      interval: usd.recurring.interval,
      interval_count: usd.recurring.interval_count,
    },
    currency_options: {
      brl: { unit_amount: brl.unit_amount },
    },
    nickname: 'Moleui monthly (multi-currency)',
  };

  console.log('Multi-currency price to create:');
  console.log(JSON.stringify(params, null, 2));

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to create the price.');
    return;
  }

  const created = await stripe.prices.create(params);
  console.log(`\nCreated price: ${created.id}`);
  console.log('Next: point the backend at it (no code change needed):');
  console.log(`  npx convex env set STRIPE_PRICE_ID ${created.id}`);
  console.log('Also enable Adaptive Pricing in the Stripe Dashboard so non-listed currencies are auto-converted.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
