import Stripe from 'stripe';
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

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

http.route({
  path: '/stripe-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return new Response('Webhook secret is not configured', { status: 500 });

    const signature = request.headers.get('stripe-signature');
    if (!signature) return new Response('Missing Stripe signature', { status: 400 });

    let event: Stripe.Event;
    try {
      event = stripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
    } catch (error) {
      return new Response(error instanceof Error ? error.message : 'Invalid webhook', { status: 400 });
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

    return new Response('ok', { status: 200 });
  }),
});

export default http;
