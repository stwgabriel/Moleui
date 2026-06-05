"use node";

import Stripe from 'stripe';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

function stripe() {
  if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(stripeSecretKey);
}

function priceIdForCountry(country: string | undefined) {
  const normalizedCountry = country?.toUpperCase();
  if (normalizedCountry === 'BR') {
    const brlPrice = process.env.STRIPE_PRICE_BRL_MONTHLY;
    if (!brlPrice) throw new Error('STRIPE_PRICE_BRL_MONTHLY is not configured');
    return brlPrice;
  }

  const usdPrice = process.env.STRIPE_PRICE_USD_MONTHLY;
  if (!usdPrice) throw new Error('STRIPE_PRICE_USD_MONTHLY is not configured');
  return usdPrice;
}

async function requireUser(ctx: ActionCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Authentication required');

  const user = await ctx.runQuery(internal.users.meForAction, { clerkUserId: identity.subject });
  if (!user) throw new Error('User profile is not synced yet');
  return user;
}

export const createCheckoutSession = action({
  args: {
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceIdForCountry(args.country ?? user.country), quantity: 1 }],
      success_url: process.env.APP_CHECKOUT_SUCCESS_URL ?? 'https://billing.moleui.local/success',
      cancel_url: process.env.APP_CHECKOUT_CANCEL_URL ?? 'https://billing.moleui.local/cancel',
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      subscription_data: {
        metadata: {
          userId: user._id,
          clerkUserId: user.clerkUserId,
        },
      },
      metadata: {
        userId: user._id,
        clerkUserId: user.clerkUserId,
        country: args.country ?? user.country ?? 'unknown',
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
