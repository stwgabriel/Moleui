"use node";

import Stripe from 'stripe';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';

function stripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(stripeSecretKey);
}

function priceIdForCountry(country: string | undefined) {
  // Only honor a well-formed ISO-3166 alpha-2 code; anything else falls through
  // to the default (USD) price rather than granting a discount on bad input.
  const normalizedCountry = typeof country === 'string' && /^[A-Z]{2}$/i.test(country)
    ? country.toUpperCase()
    : undefined;

  if (normalizedCountry === 'BR') {
    const brlPrice = process.env.STRIPE_PRICE_BRL_MONTHLY;
    if (!brlPrice) throw new Error('STRIPE_PRICE_BRL_MONTHLY is not configured');
    // Discounted (PPP) pricing path. Logged so currency/country mismatches are
    // auditable until Stripe Adaptive Pricing closes the arbitrage server-side.
    console.info(`[billing] selecting BRL price for country=${normalizedCountry}`);
    return brlPrice;
  }

  const usdPrice = process.env.STRIPE_PRICE_USD_MONTHLY;
  if (!usdPrice) throw new Error('STRIPE_PRICE_USD_MONTHLY is not configured');
  return usdPrice;
}

// Prefer a single multi-currency Price (Stripe Adaptive Pricing): Stripe then
// picks the currency from the customer's Stripe-verified location at checkout, so
// the client cannot influence pricing. Configure it with
// scripts/configure_adaptive_pricing.mjs and set STRIPE_PRICE_ID to enable.
// Fallback: per-country price selected from the server-stored country.
function checkoutLineItems(country: string | undefined): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const adaptivePriceId = process.env.STRIPE_PRICE_ID?.trim();
  if (adaptivePriceId) return [{ price: adaptivePriceId, quantity: 1 }];
  return [{ price: priceIdForCountry(country), quantity: 1 }];
}

async function checkoutDiscountOptions(client: Stripe): Promise<Pick<Stripe.Checkout.SessionCreateParams, 'allow_promotion_codes' | 'discounts'>> {
  const couponId = process.env.STRIPE_CHECKOUT_COUPON_ID?.trim();
  const promotionCodeId = process.env.STRIPE_CHECKOUT_PROMOTION_CODE_ID?.trim();
  const promotionCode = process.env.STRIPE_CHECKOUT_PROMOTION_CODE?.trim();
  const configuredDiscounts = [couponId, promotionCodeId, promotionCode].filter(Boolean);

  if (configuredDiscounts.length > 1) {
    throw new Error('Configure only one of STRIPE_CHECKOUT_COUPON_ID, STRIPE_CHECKOUT_PROMOTION_CODE_ID, or STRIPE_CHECKOUT_PROMOTION_CODE');
  }

  if (couponId) {
    return { discounts: [{ coupon: couponId }] };
  }

  if (promotionCodeId) {
    return { discounts: [{ promotion_code: promotionCodeId }] };
  }

  if (promotionCode) {
    const promotionCodes = await client.promotionCodes.list({
      code: promotionCode,
      active: true,
      limit: 10,
    });
    const matchingPromotionCode = promotionCodes.data.find((candidate) => candidate.code.toLowerCase() === promotionCode.toLowerCase());
    if (!matchingPromotionCode) throw new Error(`Stripe promotion code ${promotionCode} was not found or is not active`);
    return { discounts: [{ promotion_code: matchingPromotionCode.id }] };
  }

  return { allow_promotion_codes: true };
}

async function requireUser(ctx: ActionCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Authentication required');

  const user = await ctx.runQuery(internal.users.meForAction, { clerkUserId: identity.subject });
  if (!user) throw new Error('User profile is not synced yet');
  return user;
}

export const createCheckoutSession = action({
  // No client-supplied country: pricing is derived server-side from the user's
  // stored country (or Stripe Adaptive Pricing) so it cannot be chosen by the
  // caller. See specs/WS3-auth-payment for the full rationale.
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const client = stripe();
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await client.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user._id,
          clerkUserId: user.clerkUserId,
        },
      });
      customerId = customer.id;
      await ctx.runMutation(internal.users.setStripeCustomerId, {
        userId: user._id,
        stripeCustomerId: customerId,
      });
    }

    const discountOptions = await checkoutDiscountOptions(client);
    // Stripe Tax requires a Tax-supported account country with Tax enabled. Default
    // it off so checkout works everywhere; opt in with STRIPE_AUTOMATIC_TAX=true.
    const automaticTaxEnabled = process.env.STRIPE_AUTOMATIC_TAX === 'true';
    const customerUpdate: Stripe.Checkout.SessionCreateParams.CustomerUpdate = automaticTaxEnabled
      ? { address: 'auto', name: 'auto' }
      : { name: 'auto' };
    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: checkoutLineItems(user.country),
      success_url: process.env.APP_CHECKOUT_SUCCESS_URL ?? 'https://billing.moleui.local/success',
      cancel_url: process.env.APP_CHECKOUT_CANCEL_URL ?? 'https://billing.moleui.local/cancel',
      ...discountOptions,
      automatic_tax: { enabled: automaticTaxEnabled },
      billing_address_collection: 'auto',
      customer_update: customerUpdate,
      subscription_data: {
        metadata: {
          userId: user._id,
          clerkUserId: user.clerkUserId,
        },
      },
      metadata: {
        userId: user._id,
        clerkUserId: user.clerkUserId,
        country: user.country ?? 'unknown',
      },
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { url: session.url };
  },
});

export const createBillingPortalSession = action({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const subscription = await ctx.runQuery(internal.subscriptions.forUser, { userId: user._id });
      customerId = subscription?.stripeCustomerId;

      if (customerId) {
        await ctx.runMutation(internal.users.setStripeCustomerId, {
          userId: user._id,
          stripeCustomerId: customerId,
        });
      }
    }

    if (!customerId) throw new Error('No Stripe customer found');

    const session = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.APP_BILLING_RETURN_URL ?? 'https://billing.moleui.local/return',
    });

    return { url: session.url };
  },
});
