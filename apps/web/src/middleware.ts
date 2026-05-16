import { defineMiddleware } from 'astro:middleware';
import type { Locale } from '@accessiblewebsite/shared';

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
  // Dev convenience: if the host header is something unexpected (custom
  // /etc/hosts entry, ngrok tunnel, etc.) fall back to the cookie, then EN.
  if (cookieLang === 'de') return 'de';
  return 'en';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const host = context.request.headers.get('host');
  const cookieLang = context.cookies.get('preferred_lang')?.value;
  const locale = detectLocale(host, cookieLang);

  context.locals.locale = locale;
  context.locals.host = host ?? '';

  return next();
});
