import { z } from 'zod';

// Minimal Firecrawl /v1/scrape response. We only care about the rendered
// HTML body and the status code so we can decide whether the fetch was
// actually useful.
const FirecrawlScrapeResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      html: z.string().optional(),
      rawHtml: z.string().optional(),
      markdown: z.string().optional(),
      metadata: z
        .object({
          title: z.string().optional(),
          statusCode: z.number().optional(),
          sourceURL: z.string().optional(),
        })
        .partial()
        .optional(),
    })
    .optional(),
  error: z.string().optional(),
});

export interface FirecrawlResult {
  html: string;
  finalUrl: string;
  statusCode: number | null;
  title: string | null;
}

export async function fetchHtmlViaFirecrawl(
  url: string,
  apiKey: string,
  timeoutMs: number,
): Promise<FirecrawlResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url,
        // We need the post-render HTML (Firecrawl runs JS by default).
        // rawHtml preserves the original DOM exactly as the browser saw it
        // — important for axe-core; the cleaned `html` strips structure
        // Firecrawl deems "noise" which would defeat the audit.
        formats: ['rawHtml'],
        onlyMainContent: false,
        waitFor: 2_000,
        // Firecrawl's own per-page timeout — keep below our outer timeout
        // so its error message reaches us instead of an AbortError.
        timeout: Math.max(10_000, timeoutMs - 5_000),
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firecrawl HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const body = FirecrawlScrapeResponse.parse(await res.json());
  if (!body.success || !body.data) {
    throw new Error(`Firecrawl: ${body.error ?? 'no data returned'}`);
  }

  const html = body.data.rawHtml ?? body.data.html;
  if (!html || html.trim().length < 32) {
    throw new Error('Firecrawl returned empty HTML');
  }

  return {
    html,
    finalUrl: body.data.metadata?.sourceURL ?? url,
    statusCode: body.data.metadata?.statusCode ?? null,
    title: body.data.metadata?.title ?? null,
  };
}
