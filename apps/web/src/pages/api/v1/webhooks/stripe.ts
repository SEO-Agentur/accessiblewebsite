import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { subscriptions } from '@accessiblewebsite/db';
import { db } from '../../../../lib/db';
import { getStripe } from '../../../../lib/stripe';
import { env } from '../../../../env';

export const prerender = false;

// Events we react to. Everything else returns 200 (don't retry) and is
// logged at info level so the operator can still see them in pm2 logs.
const HANDLED = new Set<Stripe.Event['type']>([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
]);

export const POST: APIRoute = async ({ request }) => {
  const cfg = env();
  if (!cfg.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET missing — refusing to process');
    // 503 so Stripe retries once the operator finishes configuring.
    return new Response('Webhook secret not configured', { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  // CRITICAL: signature verification requires the *raw* body. Calling
  // request.json() first would normalise whitespace and break the HMAC.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, cfg.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[stripe webhook] signature verification failed:', reason);
    return new Response(`Invalid signature: ${reason}`, { status: 400 });
  }

  console.log(`[stripe webhook] ${event.type} id=${event.id}`);
  if (!HANDLED.has(event.type)) {
    return new Response('ok', { status: 200 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error(`[stripe webhook] handler error for ${event.type}:`, err);
    // 500 so Stripe retries with exponential backoff.
    return new Response('Handler error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
};

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription !== 'string') return;
      await syncSubscription(session.subscription);
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscription(sub.id);
      return;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await db()
        .update(subscriptions)
        .set({ status: 'canceled' })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id));
      return;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      if (typeof invoice.subscription === 'string') {
        await syncSubscription(invoice.subscription);
      }
      return;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      if (typeof invoice.subscription !== 'string') return;
      await db()
        .update(subscriptions)
        .set({ status: 'past_due' })
        .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription));
      return;
    }
  }
}

/**
 * Pull the canonical subscription state from Stripe and upsert it into
 * our `subscriptions` table. We always refetch the subscription (instead
 * of trusting the event payload) because subscription objects can change
 * shape across API versions and Stripe retries.
 */
async function syncSubscription(subId: string): Promise<void> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subId);

  const userId =
    sub.metadata?.userId ??
    (await guessUserIdFromCustomer(typeof sub.customer === 'string' ? sub.customer : sub.customer.id));
  if (!userId) {
    console.warn(`[stripe webhook] subscription ${subId} has no userId metadata; skipping`);
    return;
  }

  const tier = resolveTier(sub);
  if (!tier) {
    console.warn(`[stripe webhook] subscription ${subId} price not matched to a tier; skipping`);
    return;
  }

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const status = sub.status as
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'trialing'
    | string;
  const allowedStatus: Array<'active' | 'past_due' | 'canceled' | 'trialing'> = [
    'active',
    'past_due',
    'canceled',
    'trialing',
  ];
  const normalisedStatus = allowedStatus.includes(status as never)
    ? (status as 'active' | 'past_due' | 'canceled' | 'trialing')
    : 'canceled';

  const existing = await db()
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);

  const fields = {
    stripeCustomerId: customerId,
    tier,
    status: normalisedStatus,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };

  if (existing.length > 0) {
    await db()
      .update(subscriptions)
      .set(fields)
      .where(eq(subscriptions.stripeSubscriptionId, sub.id));
  } else {
    await db()
      .insert(subscriptions)
      .values({
        userId,
        stripeSubscriptionId: sub.id,
        ...fields,
      });
  }
}

function resolveTier(
  sub: Stripe.Subscription,
): 'gold' | 'gold_pro' | null {
  const metaTier = sub.metadata?.tier;
  if (metaTier === 'gold' || metaTier === 'gold_pro') return metaTier;

  // Fallback: match the price id to the env-configured prices.
  const cfg = env();
  const priceId = sub.items.data[0]?.price.id;
  if (!priceId) return null;
  if (priceId === cfg.STRIPE_PRICE_GOLD_MONTHLY || priceId === cfg.STRIPE_PRICE_GOLD_YEARLY) {
    return 'gold';
  }
  if (
    priceId === cfg.STRIPE_PRICE_GOLD_PRO_MONTHLY ||
    priceId === cfg.STRIPE_PRICE_GOLD_PRO_YEARLY
  ) {
    return 'gold_pro';
  }
  return null;
}

/**
 * If a subscription event arrives WITHOUT our metadata (e.g. the operator
 * created a subscription manually in the Stripe dashboard), fall back to
 * looking the customer up by their saved customer_id in our DB.
 */
async function guessUserIdFromCustomer(customerId: string): Promise<string | null> {
  const [row] = await db()
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row?.userId ?? null;
}
