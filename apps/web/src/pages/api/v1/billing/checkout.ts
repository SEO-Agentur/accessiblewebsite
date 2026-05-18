import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  findCustomerId,
  getStripe,
  isStripeConfigured,
  priceIdFor,
  type CheckoutCadence,
  type CheckoutTier,
} from '../../../../lib/stripe';
import { routePath } from '../../../../i18n/routes';

export const prerender = false;

const CheckoutInput = z.object({
  tier: z.enum(['gold', 'gold_pro']),
  cadence: z.enum(['monthly', 'yearly']).default('monthly'),
});

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return (await request.json()) as Record<string, unknown>;
  }
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) out[k] = typeof v === 'string' ? v : v.name;
  return out;
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const pricing = routePath('pricing', locals.locale);

  if (!locals.user) {
    return redirect(`${routePath('login', locals.locale)}?next=${encodeURIComponent(pricing)}`, 303);
  }
  if (!isStripeConfigured()) {
    return redirect(`${pricing}?error=billing_not_configured`, 303);
  }

  const raw = await readBody(request);
  const parsed = CheckoutInput.safeParse(raw);
  if (!parsed.success) {
    return redirect(`${pricing}?error=invalid_tier`, 303);
  }

  const tier: CheckoutTier = parsed.data.tier;
  const cadence: CheckoutCadence = parsed.data.cadence;
  const priceId = priceIdFor(tier, cadence);
  if (!priceId) {
    return redirect(`${pricing}?error=price_not_configured&tier=${tier}&cadence=${cadence}`, 303);
  }

  const stripe = getStripe();
  const origin = new URL(request.url).origin;

  // Reuse an existing Stripe customer if we have one, otherwise Stripe
  // will create or link a customer from `customer_email`.
  const existingCustomer = await findCustomerId(locals.user.id);
  const customerFields = existingCustomer
    ? { customer: existingCustomer }
    : { customer_email: locals.user.email };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    ...customerFields,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    // Stripe Tax handles VAT calculation across the EU. If the operator
    // hasn't enabled Stripe Tax in their dashboard, this gracefully falls
    // back to "no tax". Toggle in Stripe Dashboard > Settings > Tax.
    automatic_tax: { enabled: true },
    success_url: `${origin}${routePath('dashboard', locals.locale)}?subscribed=1`,
    cancel_url: `${origin}${pricing}?cancelled=1`,
    // Metadata is the authoritative way the webhook handler maps a
    // subscription back to our user + tier. Stored on both the Checkout
    // Session and the resulting Subscription.
    metadata: {
      userId: locals.user.id,
      tier,
      cadence,
    },
    subscription_data: {
      metadata: {
        userId: locals.user.id,
        tier,
        cadence,
      },
    },
  });

  if (!session.url) {
    return new Response('Failed to create checkout session', { status: 500 });
  }
  return redirect(session.url, 303);
};
