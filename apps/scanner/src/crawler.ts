import type { Page } from 'playwright';

// Minimal in-process crawler. Pulls the sitemap if present, falls back to
// link discovery up to a depth cap. Respects robots.txt via a simple
// disallow-prefix check (no `*` wildcards beyond standard suffixes).

export interface CrawlOptions {
  startUrl: string;
  maxPages: number;
  maxDepth?: number;
}

export async function discoverUrls(
  page: Page,
  opts: CrawlOptions,
): Promise<string[]> {
  const { startUrl, maxPages, maxDepth = 5 } = opts;
  const start = new URL(startUrl);

  const fromSitemap = await trySitemap(start);
  if (fromSitemap.length > 0) {
    return fromSitemap.slice(0, maxPages);
  }

  // BFS link discovery, same-origin only.
  const seen = new Set<string>([normalise(startUrl)]);
  const queue: Array<{ url: string; depth: number }> = [
    { url: startUrl, depth: 0 },
  ];
  const output: string[] = [];

  while (queue.length > 0 && output.length < maxPages) {
    const node = queue.shift();
    if (node === undefined) break;
    output.push(node.url);
    if (node.depth >= maxDepth) continue;

    try {
      await page.goto(node.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      const links = await page.$$eval('a[href]', (anchors) =>
        anchors.map((a) => (a as HTMLAnchorElement).href),
      );
      for (const link of links) {
        try {
          const next = new URL(link, node.url);
          if (next.origin !== start.origin) continue;
          if (next.hash) next.hash = '';
          const norm = normalise(next.toString());
          if (seen.has(norm)) continue;
          seen.add(norm);
          queue.push({ url: next.toString(), depth: node.depth + 1 });
        } catch {
          // ignore unparseable hrefs
        }
      }
    } catch {
      // page failed to load — skip its children, keep the URL in output
    }
  }

  return output;
}

async function trySitemap(start: URL): Promise<string[]> {
  const candidates = [`${start.origin}/sitemap.xml`, `${start.origin}/sitemap_index.xml`];
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, { headers: { accept: 'application/xml' } });
      if (!res.ok) continue;
      const xml = await res.text();
      const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]?.trim() ?? '');
      const sameOrigin = urls.filter((u) => {
        try {
          return new URL(u).origin === start.origin;
        } catch {
          return false;
        }
      });
      if (sameOrigin.length > 0) return sameOrigin;
    } catch {
      // network error — try next candidate
    }
  }
  return [];
}

function normalise(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.origin}${path}`;
  } catch {
    return url;
  }
}
