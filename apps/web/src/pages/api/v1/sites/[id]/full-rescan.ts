import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { monitoredSites, scans } from '@accessiblewebsite/db';
import { ScanJobPayload } from '@accessiblewebsite/shared';
import { db } from '../../../../../lib/db';
import { getScanQueue } from '../../../../../lib/queue';
import { getEffectiveTier } from '../../../../../lib/tier';
import { routePath } from '../../../../../i18n/routes';

export const prerender = false;

/**
 * Full-site scan: discovers pages via the site's saved sitemap URL (if any),
 * otherwise auto-discovery, otherwise BFS. Gated to authenticated subscribers.
 *
 * Tiering:
 *   - free      → blocked, redirect to pricing
 *   - gold      → up to 250 pages per scan
 *   - gold_pro  → up to 2,500 pages per scan
 */

const GOLD_MAX_PAGES = 250;
const GOLD_PRO_MAX_PAGES = 2_500;

export const POST: APIRoute = async ({ params, locals, redirect }) => {
  if (!locals.user) return redirect(routePath('login', locals.locale), 303);

  const siteId = params.id;
  if (typeof siteId !== 'string') return new Response('Not found', { status: 404 });

  const [site] = await db()
    .select()
    .from(monitoredSites)
    .where(and(eq(monitoredSites.id, siteId), eq(monitoredSites.userId, locals.user.id)))
    .limit(1);
  if (!site) return new Response('Not found', { status: 404 });

  // Subscription gate: full-site scans are Gold+. Free users get redirected
  // to pricing with a contextual error so the page can highlight the upgrade.
  const { tier } = await getEffectiveTier(locals.user.id);
  if (tier !== 'gold' && tier !== 'gold_pro' && tier !== 'enterprise') {
    return redirect(`${routePath('pricing', locals.locale)}?error=tier_required&need=gold`, 303);
  }
  const maxPages = tier === 'gold' ? GOLD_MAX_PAGES : GOLD_PRO_MAX_PAGES;

  const scanId = randomUUID();
  const targetUrl = `https://${site.domain}/`;

  await db().insert(scans).values({
    id: scanId,
    monitoredSiteId: site.id,
    targetUrl,
    scanType: 'full_site',
    triggeredBy: 'user',
    status: 'queued',
  });

  const payload = ScanJobPayload.parse({
    scanId,
    targetUrl,
    scanType: 'full_site',
    maxPages,
    triggeredBy: 'user',
    sitemapUrl: site.sitemapUrl ?? undefined,
  });

  await getScanQueue().add('scan', payload, {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
    // Full-site scans are slower and we may want to retry just once
    // rather than the homepage default of 2.
    attempts: 1,
  });

  return redirect(`/scan/${scanId}`, 303);
};
