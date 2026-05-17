import type { APIRoute } from 'astro';
import { SESSION_COOKIE, clearSessionCookie, deleteSession } from '../../../../lib/auth';
import { routePath } from '../../../../i18n/routes';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies, redirect }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  clearSessionCookie(cookies);

  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('application/json')) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return redirect(routePath('home', locals.locale), 303);
};
