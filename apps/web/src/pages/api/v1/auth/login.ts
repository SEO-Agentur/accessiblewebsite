import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { users } from '@accessiblewebsite/db';
import { db } from '../../../../lib/db';
import { createSession, setSessionCookie, verifyPassword } from '../../../../lib/auth';
import { routePath } from '../../../../i18n/routes';

export const prerender = false;

const LoginInput = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(256),
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
  const parsed = LoginInput.safeParse(raw);
  const login = routePath('login', locals.locale);

  if (!parsed.success) {
    if (wantsJson(request)) {
      return new Response(JSON.stringify({ error: 'validation_failed' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    return redirect(`${login}?error=invalid`, 303);
  }

  const rows = await db()
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  const user = rows[0];

  // Constant-time-ish failure: always compare against something even if no
  // user, so timing doesn't leak whether the email exists.
  const dummyHash = '$2b$12$0000000000000000000000.0000000000000000000000000000000';
  const hashToCheck = user?.passwordHash ?? dummyHash;
  const valid = await verifyPassword(parsed.data.password, hashToCheck);

  if (!user || !valid) {
    if (wantsJson(request)) {
      return new Response(JSON.stringify({ error: 'invalid_credentials' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    return redirect(`${login}?error=invalid_credentials`, 303);
  }

  const session = await createSession(user.id);
  setSessionCookie(cookies, session.token, session.expiresAt);

  if (wantsJson(request)) {
    return new Response(JSON.stringify({ ok: true, redirect: routePath('dashboard', locals.locale) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return redirect(routePath('dashboard', locals.locale), 303);
};
