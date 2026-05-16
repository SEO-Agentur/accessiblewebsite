import type { APIRoute } from 'astro';
import { ScanInitiateInput } from '@accessiblewebsite/shared';
import { routePath } from '../../../../i18n/routes';

export const prerender = false;

// Standard HTML form submits as application/x-www-form-urlencoded. Fetch/JSON
// clients use application/json. We accept both.
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

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const raw = await readBody(request);
  const parsed = ScanInitiateInput.safeParse(raw);

  if (!parsed.success) {
    const home = routePath('home', locals.locale);
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

  // TODO(scanner): enqueue ScanJobPayload on the BullMQ queue here, persist
  // a `scans` row with status='queued', return the scan id. For now we stub
  // a deterministic id from the URL so the response flow is testable end-to-end.
  const scanId = stubScanId(parsed.data.url);

  if (wantsJson(request)) {
    return new Response(JSON.stringify({ scanId, status: 'queued' }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    });
  }

  // No-JS path: full page redirect to the scan results page, which itself
  // will poll status server-side (or render "queued" and meta-refresh).
  return redirect(`/scan/${scanId}`, 303);
};

function stubScanId(url: string): string {
  // Placeholder — replace with real UUID once the queue is wired.
  const hash = Array.from(url).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  return `stub-${hash.toString(16).padStart(8, '0')}`;
}
