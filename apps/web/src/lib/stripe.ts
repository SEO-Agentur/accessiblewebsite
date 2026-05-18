import Stripe from 'stripe';
import { eq, desc } from 'drizzle-orm';
import { subscriptions } from '@accessiblewebsite/db';
import { db } from './db';
import { env } from '../env';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const cfg = env();
  if (!cfg.STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY is not configured. Set it in /opt/accessiblewebsite/.env and restart pm2.',
    );
  }
  _stripe = new Stripe(cfg.STRIPE_SECRET_KEY, {
    // Pin a stable API version so price/event payloads don't shift under us.
    // Bump this in lockstep with the `stripe` package upgrade.
    apiVersion: '2025-02-24.acacia',
    typescript: true,
    appInfo: {
      name: 'AccessibleWebsite',
      url: 'https://accessiblewebsite.net',
    },
  });
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(env().STRIPE_SECRET_KEY);
}

export type CheckoutTier = 'gold' | 'gold_pro';
export type CheckoutCadence = 'monthly' | 'yearly';

/**
 * Resolve a tier + cadence pair to a configured Stripe Price ID.
 * Returns null if the operator hasn't set the matching env var yet.
 */
export function priceIdFor(tier: CheckoutTier, cadence: CheckoutCadence): string | null {
  const cfg = env();
  const key = `${tier}_${cadence}` as const;
  switch (key) {
    case 'gold_monthly':
      return cfg.STRIPE_PRICE_GOLD_MONTHLY ?? null;
    case 'gold_yearly':
      return cfg.STRIPE_PRICE_GOLD_YEARLY ?? null;
    case 'gold_pro_monthly':
      return cfg.STRIPE_PRICE_GOLD_PRO_MONTHLY ?? null;
    case 'gold_pro_yearly':
      return cfg.STRIPE_PRICE_GOLD_PRO_YEARLY ?? null;
    default:
      return null;
  }
}

/**
 * Look up an existing Stripe customer for this user via the subscriptions
 * table (latest row wins). Returns null if the user has never subscribed.
 * We deliberately don't hit Stripe's /customers/search here — we keep our
 * DB as the source of truth for the user <-> customer link, and Checkout
 * dedupes by email if we miss it.
 */
export async function findCustomerId(userId: string): Promise<string | null> {
  const [row] = await db()
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return row?.stripeCustomerId ?? null;
}
