import type { APIRoute } from 'astro';
import { and, desc, eq, gte, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { monitoredSites, scans, subscriptions, users } from '@accessiblewebsite/db';
import { db } from '../lib/db';
import { getOwnerEmailList } from '../lib/owner';
import { MIN_DIRECTORY_SCORE } from '../lib/seal';
import { routes, type RouteKey } from '../i18n/routes';
import type { Locale } from '@accessiblewebsite/shared';

export const prerender = false;

/**
 * Dynamic XML sitemap. Decided per-domain by the middleware locale:
 *   - accessiblewebsite.net advertises EN paths (e.g. /pricing)
 *   - barrierefreiewebseite.net advertises DE paths (e.g. /preise)
 *
 * Contents:
 *   1. Every public marketing/info page in this locale
 *   2. The 10 most recently completed scans — older scans are noindex
 *      via meta tag on the scan-result view, so we deliberately omit them
 *      so crawlers don't keep chasing stale URLs
 *   3. Every gold/owner monitored_site directory entry (deep-linked to
 *      its most recent completed scan via the verified directory card)
 *
 * Hreflang isn't expressed here because each domain owns one locale; the
 * scan-result and directory pages still need the EN/DE alternate links
 * (handled in their own <head>).
 */

// Pages we want indexed on both locales. Order matters — appears in sitemap.xml
// in this order so SEO tools see the priority pages first.
const PUBLIC_ROUTES: ReadonlyArray<RouteKey> = [
  'home',
  'pricing',
  'methodology',
  'remediation',
  'verifiedIndex',
  'legalLandscape',
  'about',
  'team',
  'resources',
  'caseStudies',
  'blog',
  'privacy',
  'terms',
  'imprint',
  'accessibilityStatement',
];

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ url, locals }) => {
  const locale: Locale = locals.locale;
  const origin = url.origin;

  // 1. Static public pages.
  const staticUrls = PUBLIC_ROUTES.map((key) => ({
    loc: `${origin}${routes[key][locale]}`,
    priority: key === 'home' ? '1.0' : key === 'pricing' || key === 'remediation' ? '0.9' : '0.7',
    changefreq: key === 'home' || key === 'verifiedIndex' ? 'daily' : 'weekly',
    lastmod: null as Date | null,
  }));

  // 2. Last 10 completed scans (matches the indexable cohort: the rest are
  //    noindex on the result page).
  const recentScans = await db()
    .select({ id: scans.id, completedAt: scans.completedAt })
    .from(scans)
    .where(eq(scans.status, 'completed'))
    .orderBy(desc(scans.completedAt))
    .limit(10);

  const scanUrls = recentScans.map((s) => ({
    loc: `${origin}/scan/${s.id}`,
    priority: '0.6',
    changefreq: 'monthly',
    lastmod: s.completedAt,
  }));

  // 3. Verified directory cards — every site meeting the same criteria
  //    the /verified page uses. Each one links to its latest completed
  //    scan, so the URL ends up in the sitemap with a "current" lastmod.
  const ownerEmails = getOwnerEmailList();
  const directoryRows = await db()
    .select({
      domain: monitoredSites.domain,
      lastScanAt: monitoredSites.lastScanAt,
      latestScanId: sql<string | null>`(
        SELECT s.id FROM ${scans} s
        WHERE s.monitored_site_id = ${monitoredSites.id} AND s.status = 'completed'
        ORDER BY s.created_at DESC LIMIT 1
      )`,
    })
    .from(monitoredSites)
    .innerJoin(users, eq(users.id, monitoredSites.userId))
    .leftJoin(subscriptions, eq(subscriptions.userId, monitoredSites.userId))
    .where(
      and(
        eq(monitoredSites.isPublicInDirectory, true),
        gte(monitoredSites.currentScore, MIN_DIRECTORY_SCORE),
        isNotNull(monitoredSites.lastScanAt),
        or(
          and(
            inArray(subscriptions.tier, ['gold', 'gold_pro']),
            inArray(subscriptions.status, ['active', 'trialing']),
          ),
          ownerEmails.length > 0 ? inArray(users.email, ownerEmails) : sql`false`,
        ),
      ),
    )
    .orderBy(desc(monitoredSites.lastScanAt))
    .limit(500);

  // Dedupe on latestScanId — the leftJoin may produce duplicate rows.
  const seen = new Set<string>();
  const dirUrls = directoryRows
    .filter((r) => {
      if (!r.latestScanId) return false;
      if (seen.has(r.latestScanId)) return false;
      seen.add(r.latestScanId);
      return true;
    })
    .map((r) => ({
      loc: `${origin}/scan/${r.latestScanId}`,
      priority: '0.7',
      changefreq: 'monthly',
      lastmod: r.lastScanAt,
    }));

  // Combine, dedupe by loc (a directory entry's latestScanId might also be
  // in the recent-10 list).
  const allUrls = [...staticUrls, ...scanUrls, ...dirUrls];
  const byLoc = new Map<string, (typeof allUrls)[number]>();
  for (const u of allUrls) {
    const existing = byLoc.get(u.loc);
    if (!existing) byLoc.set(u.loc, u);
  }

  const fmtLastmod = (d: Date | null): string =>
    d ? `<lastmod>${d.toISOString()}</lastmod>` : '';

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...byLoc.values()]
  .map(
    (u) => `  <url>
    <loc>${esc(u.loc)}</loc>${u.lastmod ? `\n    ${fmtLastmod(u.lastmod)}` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
};
