#!/usr/bin/env node

import Stripe from 'stripe';

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

async function retrieveOrCreateCoupon(stripe, couponId, duration) {
  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    if (coupon.deleted) {
      throw new Error(`Coupon ${couponId} was deleted. Choose another --coupon-id.`);
    }
    if (coupon.percent_off !== 100) {
      throw new Error(`Coupon ${couponId} already exists but is not 100% off.`);
    }
    return coupon;
  } catch (error) {
    if (error?.statusCode !== 404) throw error;
  }

  return stripe.coupons.create({
    id: couponId,
    name: 'Moleui 100% off test coupon',
    percent_off: 100,
    duration,
  });
}

async function retrieveOrCreatePromotionCode(stripe, couponId, code) {
  const promotionCodes = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 20,
  });
  const existing = promotionCodes.data.find((promotionCode) => promotionCode.coupon.id === couponId);
  if (existing) return existing;

  return stripe.promotionCodes.create({
    coupon: couponId,
    code,
  });
}

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const allowLive = process.argv.includes('--live');
  const couponId = argValue('--coupon-id', 'moleui_100_off_test');
  const code = argValue('--code', 'MOLEUI100');
  const duration = argValue('--duration', 'forever');

  if (!secretKey) {
    throw new Error('Set STRIPE_SECRET_KEY to a Stripe test secret key before running this script.');
  }

  if (secretKey.startsWith('sk_live_') && !allowLive) {
    throw new Error('Refusing to create a live-mode coupon without --live.');
  }

  if (!['forever', 'once'].includes(duration)) {
    throw new Error('--duration must be either forever or once.');
  }

  const stripe = new Stripe(secretKey);
  const coupon = await retrieveOrCreateCoupon(stripe, couponId, duration);
  const promotionCode = await retrieveOrCreatePromotionCode(stripe, coupon.id, code);

  console.log(`Coupon ID: ${coupon.id}`);
  console.log(`Promotion code: ${promotionCode.code}`);
  console.log(`Promotion code ID: ${promotionCode.id}`);
  console.log(`Convex env: STRIPE_CHECKOUT_PROMOTION_CODE_ID=${promotionCode.id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
