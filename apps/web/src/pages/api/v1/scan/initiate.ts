import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { ScanInitiateInput, ScanJobPayload } from '@accessiblewebsite/shared';
import { scans } from '@accessiblewebsite/db';
import { db } from '../../../../lib/db';
import { getScanQueue } from '../../../../lib/queue';
import { consumeRateLimit, realClientIp } from '../../../../lib/rateLimit';
import { routePath } from '../../../../i18n/routes';
import { env } from '../../../../env';

export const prerender = false;

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as Record<string, unknown>;
  }
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    out[k] = typeof v === 'string' ? v : v.name;
  }
  return out;
}

function wantsJson(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  return accept.includes('application/json');
}

export const POST: APIRoute = async ({ request, locals, redirect, clientAddress }) => {
  const raw = await readBody(request);
  const parsed = ScanInitiateInput.safeParse(raw);

  const home = routePath('home', locals.locale);

  if (!parsed.success) {
    if (wantsJson(request)) {
      return new Response(
        JSON.stringify({
          error: 'validation_failed',
          detail: parsed.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }
    return redirect(`${home}?error=invalid_url`, 303);
  }

  // Anonymous rate limit. Operators carrying the bypass token (set via the
  // ?unlimitedcy= URL param or its companion cookie) skip the limiter.
  // Logged-in users also skip (a per-user daily counter belongs here once
  // we wire it; for now an authenticated request implies a trusted
  // session, which is fine — sessions are signup-gated).
  if (!locals.bypassRateLimit && locals.user === null) {
    const ip = realClientIp(request, clientAddress);
    const cfg = env();
    const rl = await consumeRateLimit(
      `ratelimit:scan:anon:${ip}`,
      cfg.SCAN_RATE_ANONYMOUS_PER_HOUR,
      3600,
    );
    if (!rl.allowed) {
      if (wantsJson(request)) {
        return new Response(
          JSON.stringify({
            error: 'rate_limited',
            resetSeconds: rl.resetSeconds,
          }),
          {
            status: 429,
            headers: {
              'content-type': 'application/json',
              'retry-after': String(rl.resetSeconds),
            },
          },
        );
      }
      return redirect(`${home}?error=rate_limited`, 303);
    }
  }

  const scanId = randomUUID();
  const targetUrl = parsed.data.url;
  const anonymousEmail = parsed.data.email ?? null;

  // Insert the scan row first, then enqueue. If the queue is down the row
  // still exists with status='queued' and a future re-drive can recover it.
  await db()
    .insert(scans)
    .values({
      id: scanId,
      targetUrl,
      scanType: 'homepage',
      triggeredBy: 'anonymous',
      status: 'queued',
      anonymousEmail,
    });

  const payload = ScanJobPayload.parse({
    scanId,
    targetUrl,
    scanType: 'homepage',
    maxPages: 1,
    triggeredBy: 'anonymous',
  });

  await getScanQueue().add('scan', payload, {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  });

  if (wantsJson(request)) {
    return new Response(JSON.stringify({ scanId, status: 'queued' }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    });
  }
  return redirect(`/scan/${scanId}`, 303);
};
