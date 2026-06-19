"use node";

import Stripe from 'stripe';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

function stripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(stripeSecretKey);
}

function subscriptionPayload(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    stripeCustomerId: String(subscription.customer),
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId: item?.price?.id,
    currency: item?.price?.currency,
    currentPeriodEnd: subscription.current_period_end ? subscription.current_period_end * 1000 : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

export const handleStripeWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return { status: 500, body: 'Webhook secret is not configured' };

    let event: Stripe.Event;
    try {
      event = stripe().webhooks.constructEvent(args.payload, args.signature, webhookSecret);
    } catch (error) {
      return { status: 400, body: error instanceof Error ? error.message : 'Invalid webhook' };
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await ctx.runMutation(internal.subscriptions.upsertFromStripe, subscriptionPayload(event.data.object as Stripe.Subscription));
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const subscription = await stripe().subscriptions.retrieve(String(session.subscription));
        await ctx.runMutation(internal.subscriptions.upsertFromStripe, subscriptionPayload(subscription));
      }
    }

    return { status: 200, body: 'ok' };
  },
});
