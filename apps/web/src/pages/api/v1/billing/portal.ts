import type { APIRoute } from 'astro';
import { findCustomerId, getStripe, isStripeConfigured } from '../../../../lib/stripe';
import { routePath } from '../../../../i18n/routes';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.user) {
    return redirect(routePath('login', locals.locale), 303);
  }
  const dashboard = routePath('dashboard', locals.locale);

  if (!isStripeConfigured()) {
    return redirect(`${dashboard}?error=billing_not_configured`, 303);
  }

  const customerId = await findCustomerId(locals.user.id);
  if (!customerId) {
    // User has never subscribed — nothing to manage. Send them to pricing.
    return redirect(routePath('pricing', locals.locale), 303);
  }

  const stripe = getStripe();
  const origin = new URL(request.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}${dashboard}`,
  });

  return redirect(session.url, 303);
};
