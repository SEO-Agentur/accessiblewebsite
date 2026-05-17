import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { monitoredSites, scans } from '@accessiblewebsite/db';
import { ScanJobPayload } from '@accessiblewebsite/shared';
import { db } from '../../../../../lib/db';
import { getScanQueue } from '../../../../../lib/queue';
import { routePath } from '../../../../../i18n/routes';

export const prerender = false;

/**
 * Full-site scan: discovers pages via the site's saved sitemap URL (if any),
 * otherwise auto-discovery, otherwise BFS. Gated to authenticated users.
 *
 * Page cap is sourced from env so we can tier it later (Gold 250, Gold Pro
 * 2,500) once subscription wiring lands.
 */

// Conservative default until subscription tier check is wired.
const DEFAULT_MAX_PAGES = 250;

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
    maxPages: DEFAULT_MAX_PAGES,
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
