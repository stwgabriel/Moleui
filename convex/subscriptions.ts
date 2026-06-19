import { internalMutation, internalQuery, query } from './_generated/server';
import { v } from 'convex/values';
import type { QueryCtx } from './_generated/server';

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

async function currentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', identity.subject))
    .first();
}

export const entitlement = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      return {
        isSubscribed: false,
        status: 'signed_out',
        subscription: null,
      };
    }

    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_user_id', (q) => q.eq('userId', user._id))
      .first();
    const isSubscribed = subscription ? ACTIVE_STATUSES.has(subscription.status) : false;

    return {
      isSubscribed,
      status: subscription?.status ?? 'none',
      subscription,
    };
  },
});

export const forUser = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('subscriptions')
      .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
      .first();
  },
});

export const upsertFromStripe = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.string(),
    priceId: v.optional(v.string()),
    currency: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_stripe_customer_id', (q) => q.eq('stripeCustomerId', args.stripeCustomerId))
      .first();

    if (!user) {
      console.warn(
        `[stripe] upsertFromStripe: no user matches stripeCustomerId=${args.stripeCustomerId} ` +
        `(subscription=${args.stripeSubscriptionId ?? 'n/a'}, status=${args.status}); event dropped`,
      );
      return;
    }

    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_user_id', (q) => q.eq('userId', user._id))
      .first();
    const nextSubscription = {
      userId: user._id,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      status: args.status,
      priceId: args.priceId,
      currency: args.currency,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, nextSubscription);
      return;
    }

    await ctx.db.insert('subscriptions', nextSubscription);
  },
});
