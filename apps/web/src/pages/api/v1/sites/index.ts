import type { APIRoute } from 'astro';
import { z } from 'zod';
import { randomUUID, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { monitoredSites } from '@accessiblewebsite/db';
import { db } from '../../../../lib/db';
import { routePath } from '../../../../i18n/routes';

export const prerender = false;

const AddSiteInput = z.object({
  domain: z
    .string()
    .trim()
    .min(3)
    .max(253)
    .transform((s) => s.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')),
});

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await request.json()) as Record<string, unknown>;
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) out[k] = typeof v === 'string' ? v : v.name;
  return out;
}

function wantsJson(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('application/json');
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.user) {
    if (wantsJson(request)) return new Response('Unauthorized', { status: 401 });
    return redirect(routePath('login', locals.locale), 303);
  }

  const raw = await readBody(request);
  const parsed = AddSiteInput.safeParse(raw);
  const dashboard = routePath('dashboard', locals.locale);

  if (!parsed.success) {
    if (wantsJson(request)) {
      return new Response(JSON.stringify({ error: 'invalid_domain' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    return redirect(`${dashboard}?error=invalid_domain`, 303);
  }

  // Reject if user already monitors this domain.
  const existing = await db()
    .select({ id: monitoredSites.id })
    .from(monitoredSites)
    .where(and(eq(monitoredSites.userId, locals.user.id), eq(monitoredSites.domain, parsed.data.domain)))
    .limit(1);

  if (existing.length > 0) {
    if (wantsJson(request)) {
      return new Response(JSON.stringify({ error: 'duplicate' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      });
    }
    return redirect(`${dashboard}?error=duplicate`, 303);
  }

  await db()
    .insert(monitoredSites)
    .values({
      id: randomUUID(),
      userId: locals.user.id,
      domain: parsed.data.domain,
      verificationToken: randomBytes(24).toString('base64url'),
      verificationStatus: 'pending',
      sealTier: 'none',
    });

  if (wantsJson(request)) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  }
  return redirect(`${dashboard}?added=1`, 303);
};
