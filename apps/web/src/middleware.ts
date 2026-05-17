import { defineMiddleware } from 'astro:middleware';
import type { Locale } from '@accessiblewebsite/shared';
import { readSessionUser } from './lib/auth';
import { env } from './env';

const BYPASS_PARAM = 'unlimitedcy';
const BYPASS_COOKIE = 'unlimitedcy';
const BYPASS_COOKIE_TTL_SECONDS = 24 * 60 * 60;

const EN_HOSTS = new Set([
  'accessiblewebsite.net',
  'www.accessiblewebsite.net',
  'localhost:4100',
  '127.0.0.1:4100',
]);

const DE_HOSTS = new Set([
  'barrierefreiewebseite.net',
  'www.barrierefreiewebseite.net',
]);

function detectLocale(host: string | null, cookieLang: string | undefined): Locale {
  if (host !== null) {
    if (DE_HOSTS.has(host)) return 'de';
    if (EN_HOSTS.has(host)) return 'en';
  }
  if (cookieLang === 'de') return 'de';
  return 'en';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const host = context.request.headers.get('host');
  const cookieLang = context.cookies.get('preferred_lang')?.value;
  const locale = detectLocale(host, cookieLang);

  context.locals.locale = locale;
  context.locals.host = host ?? '';
  context.locals.user = await readSessionUser(context.cookies);

  // Rate-limit bypass: matches ?unlimitedcy=<TOKEN> in the URL OR an
  // existing unlimitedcy cookie carrying the same TOKEN. First match on
  // the URL also stamps a 24h cookie so the operator doesn't have to keep
  // appending the param across navigations. No effect when
  // RATELIMIT_BYPASS_TOKEN is unset.
  const bypassToken = env().RATELIMIT_BYPASS_TOKEN;
  let bypass = false;
  if (bypassToken) {
    const paramValue = context.url.searchParams.get(BYPASS_PARAM);
    if (paramValue === bypassToken) {
      bypass = true;
      context.cookies.set(BYPASS_COOKIE, paramValue, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: BYPASS_COOKIE_TTL_SECONDS,
      });
    } else if (context.cookies.get(BYPASS_COOKIE)?.value === bypassToken) {
      bypass = true;
    }
  }
  context.locals.bypassRateLimit = bypass;

  return next();
});
