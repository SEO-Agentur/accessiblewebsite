import type { APIRoute } from 'astro';
import { and, desc, eq, gte, ilike, or } from 'drizzle-orm';
import { scans } from '@accessiblewebsite/db';
import { db } from '../../../../../lib/db';
import {
  renderSealSvg,
  SEAL_VALIDITY_DAYS,
  tierFromScore,
  type SealTier,
} from '../../../../../lib/seal';

export const prerender = false;

const SVG_HEADERS = {
  'content-type': 'image/svg+xml; charset=utf-8',
  // Cache 5 min at browser, 1 hour at CF edge. Seal status changes are
  // infrequent enough that an hour of staleness is fine — a customer who
  // just earned a seal sees it immediately from the scan results page.
  'cache-control': 'public, max-age=300, s-maxage=3600',
  // Defensive: tell scrapers what kind of file this is.
  'content-disposition': 'inline',
};

// Conservative domain validator: ASCII labels separated by dots, valid TLD.
// Prevents path traversal and injection through the URL segment.
const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export const GET: APIRoute = async ({ params, locals }) => {
  const rawDomain = (params.domain ?? '').toString().toLowerCase().trim();
  // Strip a possible www. prefix so customers who scanned the bare apex
  // can embed the seal on www.example.com (and vice versa).
  const domain = rawDomain.startsWith('www.') ? rawDomain.slice(4) : rawDomain;
  const locale = locals.locale === 'de' ? 'de' : 'en';

  if (!DOMAIN_RE.test(domain)) {
    return new Response(renderSealSvg('expired', 'invalid-domain', locale), {
      status: 400,
      headers: SVG_HEADERS,
    });
  }

  const cutoff = new Date(Date.now() - SEAL_VALIDITY_DAYS * 86_400_000);

  // Match scans where the target URL points at this domain (apex or www).
  const rows = await db()
    .select()
    .from(scans)
    .where(
      and(
        eq(scans.status, 'completed'),
        gte(scans.completedAt, cutoff),
        or(
          ilike(scans.targetUrl, `https://${domain}/%`),
          ilike(scans.targetUrl, `https://${domain}`),
          ilike(scans.targetUrl, `https://www.${domain}/%`),
          ilike(scans.targetUrl, `https://www.${domain}`),
          ilike(scans.targetUrl, `http://${domain}/%`),
          ilike(scans.targetUrl, `http://${domain}`),
          ilike(scans.targetUrl, `http://www.${domain}/%`),
          ilike(scans.targetUrl, `http://www.${domain}`),
        ),
      ),
    )
    .orderBy(desc(scans.completedAt))
    .limit(1);

  const latest = rows[0];
  const tier: SealTier = latest ? (tierFromScore(latest.score) ?? 'expired') : 'expired';

  return new Response(renderSealSvg(tier, domain, locale), {
    status: 200,
    headers: SVG_HEADERS,
  });
};
