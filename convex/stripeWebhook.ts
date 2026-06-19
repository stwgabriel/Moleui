"use node";

import Stripe from 'stripe';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import type { ActionCtx } from './_generated/server';

function stripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(stripeSecretKey);
}

// `current_period_end` moved from the Subscription onto its items in recent
// Stripe API versions. Read whichever is present so renewal dates persist.
function periodEndMs(subscription: Stripe.Subscription): number | undefined {
  const fromSubscription = (subscription as { current_period_end?: number }).current_period_end;
  const fromItem = (subscription.items?.data?.[0] as { current_period_end?: number } | undefined)?.current_period_end;
  const seconds = fromSubscription ?? fromItem;
  return seconds ? seconds * 1000 : undefined;
}

function subscriptionPayload(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    stripeCustomerId: String(subscription.customer),
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId: item?.price?.id,
    currency: item?.price?.currency,
    currentPeriodEnd: periodEndMs(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

// The invoice -> subscription reference moved under `parent` in recent API
// versions. Check both shapes so paid/failed invoices still resolve.
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  const direct = (invoice as { subscription?: string | { id: string } | null }).subscription;
  if (direct) return typeof direct === 'string' ? direct : direct.id;
  const nested = (
    invoice as { parent?: { subscription_details?: { subscription?: string | { id: string } | null } } }
  ).parent?.subscription_details?.subscription;
  if (nested) return typeof nested === 'string' ? nested : nested.id;
  return undefined;
}

async function syncSubscriptionById(ctx: ActionCtx, client: Stripe, subscriptionId: string) {
  const subscription = await client.subscriptions.retrieve(subscriptionId);
  await ctx.runMutation(internal.subscriptions.upsertFromStripe, subscriptionPayload(subscription));
}

export const handleStripeWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return { status: 500, body: 'Webhook secret is not configured' };

    const client = stripe();
    let event: Stripe.Event;
    try {
      event = client.webhooks.constructEvent(args.payload, args.signature, webhookSecret);
    } catch (error) {
      return { status: 400, body: error instanceof Error ? error.message : 'Invalid webhook' };
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await ctx.runMutation(
          internal.subscriptions.upsertFromStripe,
          subscriptionPayload(event.data.object as Stripe.Subscription),
        );
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          await syncSubscriptionById(ctx, client, String(session.subscription));
        }
        break;
      }
      // A failed renewal does not immediately flip the subscription status, so
      // sync explicitly to revoke access without waiting for Stripe's retries.
      // `invoice.paid` re-grants access once a recovered payment succeeds.
      case 'invoice.payment_failed':
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        if (subscriptionId) {
          await syncSubscriptionById(ctx, client, subscriptionId);
        }
        break;
      }
    }

    return { status: 200, body: 'ok' };
  },
});
