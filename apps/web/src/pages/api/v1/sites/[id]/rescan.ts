import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { monitoredSites, scans } from '@accessiblewebsite/db';
import { ScanJobPayload } from '@accessiblewebsite/shared';
import { db } from '../../../../../lib/db';
import { getScanQueue } from '../../../../../lib/queue';
import { routePath } from '../../../../../i18n/routes';

export const prerender = false;

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
    scanType: 'homepage',
    triggeredBy: 'user',
    status: 'queued',
  });

  const payload = ScanJobPayload.parse({
    scanId,
    targetUrl,
    scanType: 'homepage',
    maxPages: 1,
    triggeredBy: 'user',
  });
  await getScanQueue().add('scan', payload, {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  });

  return redirect(`/scan/${scanId}`, 303);
};
