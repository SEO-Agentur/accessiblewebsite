import type { Page } from 'playwright';

// Page-discovery for full-site scans. Prefers an operator-supplied
// sitemap.xml URL when present, falls back to well-known /sitemap.xml
// and /sitemap_index.xml, and last-resorts to a same-origin BFS link crawl.

export interface CrawlOptions {
  startUrl: string;
  maxPages: number;
  maxDepth?: number;
  /**
   * If provided, the crawler fetches this URL as a sitemap before any
   * auto-discovery. Sitemap-index files are followed one level (limited
   * to MAX_SITEMAP_CHILDREN sub-sitemaps to bound work).
   */
  sitemapUrl?: string;
}

const MAX_SITEMAP_CHILDREN = 25;
const SITEMAP_FETCH_TIMEOUT_MS = 10_000;

export async function discoverUrls(
  page: Page,
  opts: CrawlOptions,
): Promise<string[]> {
  const { startUrl, maxPages, maxDepth = 5, sitemapUrl } = opts;
  const start = new URL(startUrl);

  // 1) Explicit sitemap URL — operator-trusted source of truth
  if (sitemapUrl) {
    const urls = await fetchSitemap(sitemapUrl, start.origin, 0);
    if (urls.length > 0) {
      return urls.slice(0, maxPages);
    }
  }

  // 2) Auto-discover the common locations
  const fromSitemap = await trySitemap(start);
  if (fromSitemap.length > 0) {
    return fromSitemap.slice(0, maxPages);
  }

  // 3) Fall back to same-origin BFS link discovery
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
  for (const candidate of [
    `${start.origin}/sitemap.xml`,
    `${start.origin}/sitemap_index.xml`,
  ]) {
    const urls = await fetchSitemap(candidate, start.origin, 0);
    if (urls.length > 0) return urls;
  }
  return [];
}

/**
 * Fetch a sitemap (or sitemap index) and return the page URLs it lists.
 * `depth` bounds recursion through sitemap-index files (one level max).
 */
async function fetchSitemap(
  url: string,
  originLimit: string,
  depth: number,
): Promise<string[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), SITEMAP_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { accept: 'application/xml, text/xml, */*' },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // sitemapindex → recurse once into child sitemaps
    if (/<sitemapindex[\s>]/i.test(xml) && depth === 0) {
      const childSitemaps = extractLocs(xml).slice(0, MAX_SITEMAP_CHILDREN);
      const all: string[] = [];
      for (const child of childSitemaps) {
        const pages = await fetchSitemap(child, originLimit, depth + 1);
        all.push(...pages);
        // safety cap regardless of caller's maxPages
        if (all.length > 10_000) break;
      }
      return dedupeSameOrigin(all, originLimit);
    }

    return dedupeSameOrigin(extractLocs(xml), originLimit);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
    .map((m) => (m[1] ?? '').trim())
    .filter((u) => u.length > 0);
}

function dedupeSameOrigin(urls: string[], originLimit: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    try {
      const parsed = new URL(u);
      if (parsed.origin !== originLimit) continue;
      const norm = normalise(parsed.toString());
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push(parsed.toString());
    } catch {
      // skip unparseable
    }
  }
  return out;
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
