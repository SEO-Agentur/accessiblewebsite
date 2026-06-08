import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { monitoredSites } from '@accessiblewebsite/db';
import { db } from '../../../../../lib/db';
import { routePath } from '../../../../../i18n/routes';

export const prerender = false;

/**
 * Remove a monitored site. The schema cascades:
 *   monitored_sites → scans → scan_issues
 * So deleting the site drops the full scan history too. Operators who
 * just want to stop public listing should toggle is_public_in_directory
 * instead — but that UI doesn't exist yet, so delete is the only knob.
 */
export const POST: APIRoute = async ({ params, locals, redirect, request }) => {
  if (!locals.user) {
    return redirect(routePath('login', locals.locale), 303);
  }

  const siteId = params.id;
  if (typeof siteId !== 'string') {
    return new Response('Not found', { status: 404 });
  }

  const dashboard = routePath('dashboard', locals.locale);

  // Lightweight CSRF guard: only accept form posts originating from our own
  // dashboard. The site cookie still gates auth above; this is belt+braces
  // against a one-click attacker form on a third-party page.
  const referer = request.headers.get('referer') ?? '';
  if (referer && !referer.includes('/dashboard') && !referer.includes('/dashb')) {
    return redirect(dashboard, 303);
  }

  const result = await db()
    .delete(monitoredSites)
    .where(
      and(eq(monitoredSites.id, siteId), eq(monitoredSites.userId, locals.user.id)),
    )
    .returning({ id: monitoredSites.id });

  if (result.length === 0) {
    return redirect(`${dashboard}?error=not_found`, 303);
  }
  return redirect(`${dashboard}?deleted=1`, 303);
};
