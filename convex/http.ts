import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

http.route({
  path: '/stripe-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get('stripe-signature');
    if (!signature) return new Response('Missing Stripe signature', { status: 400 });

    const result = await ctx.runAction(internal.stripeWebhook.handleStripeWebhook, {
      payload: await request.text(),
      signature,
    });
    return new Response(result.body, { status: result.status });
  }),
});

export default http;
