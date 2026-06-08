import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Per-domain robots.txt. We allow general crawling everywhere except the
 * authed dashboard + raw API surface, and advertise the locale-correct
 * sitemap.xml. The locale is decided by middleware from the Host header,
 * which means each domain serves the right URLs without manual config.
 *
 * Cloudflare's "Managed robots.txt" can shadow this — disable it in the
 * Cloudflare dashboard (Security → Bots) for our origin to actually be hit.
 */
function publicOrigin(request: Request, locale: 'en' | 'de'): string {
  // Astro sits behind Caddy, which sits behind Cloudflare. url.origin reports
  // the internal 127.0.0.1:4100 hostname instead of the public one, so we
  // pick the public origin from the locale the middleware already decided
  // from the Host header.
  return locale === 'de'
    ? 'https://barrierefreiewebseite.net'
    : 'https://accessiblewebsite.net';
}

export const GET: APIRoute = async ({ locals, request }) => {
  const origin = publicOrigin(request, locals.locale);
  const body = `# robots.txt — accessiblewebsite.net / barrierefreiewebseite.net
# Generated dynamically. Sitemap is locale-aware via Host header.

User-agent: *
Disallow: /api/
Disallow: /dashboard
Disallow: /dashb
Disallow: /login
Disallow: /signup
Disallow: /anmelden
Disallow: /registrieren
Allow: /api/v1/seal/

# Scan results older than the 10 most recent are marked noindex via meta tag;
# the sitemap only lists the current 10 so crawlers stay on fresh URLs.
Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
};
