import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { Locale } from '@accessiblewebsite/shared';
import { users } from '@accessiblewebsite/db';
import { db } from '../../../../lib/db';
import { createSession, hashPassword, setSessionCookie } from '../../../../lib/auth';
import { routePath } from '../../../../i18n/routes';

export const prerender = false;

const SignupInput = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: z.string().email().toLowerCase(),
  password: z.string().min(12).max(256),
  marketingConsent: z.coerce.boolean().optional(),
  language: Locale.optional(),
});

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as Record<string, unknown>;
  }
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) out[k] = typeof v === 'string' ? v : v.name;
  return out;
}

function wantsJson(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('application/json');
}

export const POST: APIRoute = async ({ request, locals, cookies, redirect }) => {
  const raw = await readBody(request);
  const parsed = SignupInput.safeParse(raw);
  const signup = routePath('signup', locals.locale);

  if (!parsed.success) {
    if (wantsJson(request)) {
      return new Response(
        JSON.stringify({ error: 'validation_failed', detail: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }
    return redirect(`${signup}?error=invalid`, 303);
  }

  const data = parsed.data;
  const existing = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (existing.length > 0) {
    if (wantsJson(request)) {
      return new Response(JSON.stringify({ error: 'email_taken' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      });
    }
    return redirect(`${signup}?error=email_taken`, 303);
  }

  const passwordHash = await hashPassword(data.password);
  const [user] = await db()
    .insert(users)
    .values({
      email: data.email,
      fullName: data.fullName,
      passwordHash,
      preferredLanguage: data.language ?? locals.locale,
      marketingConsentAt: data.marketingConsent ? new Date() : null,
    })
    .returning({ id: users.id });

  if (!user) {
    return new Response('Server error', { status: 500 });
  }

  const session = await createSession(user.id);
  setSessionCookie(cookies, session.token, session.expiresAt);

  if (wantsJson(request)) {
    return new Response(JSON.stringify({ ok: true, redirect: routePath('dashboard', locals.locale) }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  }
  return redirect(routePath('dashboard', locals.locale), 303);
};
