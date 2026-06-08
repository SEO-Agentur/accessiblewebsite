import type { APIRoute } from 'astro';
import { t } from '../i18n';
import { routePath } from '../i18n/routes';
import type { Locale } from '@accessiblewebsite/shared';

export const prerender = false;

/**
 * llms.txt — a markdown summary of the site for LLM crawlers. Spec:
 *   https://llmstxt.org/
 * Locale-aware via middleware: the operator gets the EN version on
 * accessiblewebsite.net and the DE version on barrierefreiewebseite.net.
 */
export const GET: APIRoute = async ({ locals }) => {
  const locale: Locale = locals.locale;
  const isDE = locale === 'de';
  const strings = t(locale);
  // Astro sits behind Caddy → url.origin is 127.0.0.1; pin to the real
  // public origin based on the locale the middleware decided from Host.
  const origin =
    locale === 'de'
      ? 'https://barrierefreiewebseite.net'
      : 'https://accessiblewebsite.net';

  const body = isDE
    ? `# Barrierefreiewebseite

> Unabhängige Prüfung von Webseiten auf WCAG 2.2 AA Konformität. Echte Code-Korrekturen durch Fachkräfte, keine Overlay-Widgets. Kostenloser Scan, transparente Festpreise für Umsetzung, Bronze-/Silber-/Gold-Siegel mit Live-Verifikation.

## Wichtige Seiten

- [Startseite — Kostenloser Scan](${origin}${routePath('home', locale)}): WCAG-2.2-AA-Prüfung in 10–30 Sekunden
- [Preise](${origin}${routePath('pricing', locale)}): Monitoring ab 0 €, Gold-Abo 9 €/Monat, Umsetzung ab 499 € einmalig
- [Methodik](${origin}${routePath('methodology', locale)}): Wie wir prüfen — axe-core, echter Browser-Kontext, EN 301 549
- [Umsetzung](${origin}${routePath('remediation', locale)}): Festpreis-Pakete für Code-Korrekturen mit 100 %-Garantie
- [Verifizierte Webseiten](${origin}${routePath('verifiedIndex', locale)}): Öffentliches Verzeichnis aller Gold-Mitglieder
- [Rechtslage 2026](${origin}${routePath('legalLandscape', locale)}): EAA, BFSG, ADA Title III, Section 508

## Über

${strings.meta.defaultDescription}

Kontakt: ${origin}${routePath('imprint', locale)}
`
    : `# AccessibleWebsite

> Independent WCAG 2.2 AA accessibility audits for the open web. Real code fixes by certified accessibility specialists — no overlay widgets. Free scan, transparent fixed-price remediation, Bronze/Silver/Gold seals with live verification.

## Key pages

- [Home — Free scan](${origin}${routePath('home', locale)}): WCAG 2.2 AA check in 10–30 seconds
- [Pricing](${origin}${routePath('pricing', locale)}): Monitoring from €0, Gold subscription €9/mo, remediation from €499 one-time
- [Methodology](${origin}${routePath('methodology', locale)}): How we audit — axe-core, real browser context, EN 301 549
- [Remediation](${origin}${routePath('remediation', locale)}): Fixed-price code-fix packages with a 100% guarantee
- [Verified websites](${origin}${routePath('verifiedIndex', locale)}): Public directory of all Gold members
- [Legal landscape 2026](${origin}${routePath('legalLandscape', locale)}): EAA, BFSG, ADA Title III, Section 508

## About

${strings.meta.defaultDescription}

Contact: ${origin}${routePath('imprint', locale)}
`;

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
};
