// =============================================================================
// Route mapping — single source of truth for EN <-> DE URL translation.
//
// Every page in the app references a stable route KEY (e.g. "remediation").
// The key resolves to a localised path at render time via routePath(key, locale)
// and to the equivalent path on the other domain via switchLocale(key, locale).
//
// Add a new page = add a new entry here, BOTH locales required, BEFORE creating
// the .astro file. The catch-all router in src/pages/[...slug].astro uses this
// table to resolve an incoming path to a route key.
// =============================================================================

import type { Locale } from '@accessiblewebsite/shared';

export type RouteKey =
  | 'home'
  | 'pricing'
  | 'methodology'
  | 'remediation'
  | 'blog'
  | 'about'
  | 'team'
  | 'resources'
  | 'caseStudies'
  | 'legalLandscape'
  | 'dashboard'
  | 'login'
  | 'signup'
  | 'verifiedIndex'
  | 'privacy'
  | 'terms'
  | 'imprint'
  | 'accessibilityStatement'
  | 'quoteConfirmation';

type LocalisedPath = { readonly en: string; readonly de: string };

export const routes: Readonly<Record<RouteKey, LocalisedPath>> = {
  home: { en: '/', de: '/' },
  pricing: { en: '/pricing', de: '/preise' },
  methodology: { en: '/methodology', de: '/methodik' },
  remediation: {
    en: '/make-my-site-compliant',
    de: '/webseite-barrierefrei-machen',
  },
  blog: { en: '/blog', de: '/blog' },
  about: { en: '/about', de: '/ueber-uns' },
  team: { en: '/team', de: '/team' },
  resources: { en: '/resources', de: '/ressourcen' },
  caseStudies: { en: '/case-studies', de: '/fallstudien' },
  legalLandscape: { en: '/legal-landscape', de: '/rechtslage' },
  dashboard: { en: '/dashboard', de: '/dashboard' },
  login: { en: '/login', de: '/anmelden' },
  signup: { en: '/signup', de: '/registrieren' },
  verifiedIndex: { en: '/verified', de: '/verifiziert' },
  privacy: { en: '/privacy', de: '/datenschutz' },
  terms: { en: '/terms', de: '/agb' },
  // /impressum is a legal requirement under German law (§ 5 TMG).
  // EN has no equivalent — fall back to the imprint at the DE URL, which
  // also satisfies the EN-domain visitor reaching it directly.
  imprint: { en: '/imprint', de: '/impressum' },
  accessibilityStatement: {
    en: '/accessibility-statement',
    de: '/barrierefreiheitserklaerung',
  },
  quoteConfirmation: {
    en: '/quote-confirmation',
    de: '/angebot-bestaetigt',
  },
} as const;

// Dynamic route patterns — these are NOT in the table because the dynamic
// segment varies per request. The catch-all handles them separately.
export const DYNAMIC_ROUTES = {
  scan: { en: '/scan/', de: '/scan/' },
  verifiedDomain: { en: '/verified/', de: '/verifiziert/' },
} as const;

// -----------------------------------------------------------------------------
// Lookup helpers
// -----------------------------------------------------------------------------

export function routePath(key: RouteKey, locale: Locale): string {
  return routes[key][locale];
}

export function switchLocale(
  key: RouteKey,
  targetLocale: Locale,
): string {
  return routes[key][targetLocale];
}

// Reverse lookup: incoming path -> route key (for the current locale).
// Returns null if the path doesn't match a known static route.
const pathToKey: Record<Locale, ReadonlyMap<string, RouteKey>> = {
  en: new Map(
    (Object.entries(routes) as [RouteKey, LocalisedPath][]).map(([k, v]) => [v.en, k]),
  ),
  de: new Map(
    (Object.entries(routes) as [RouteKey, LocalisedPath][]).map(([k, v]) => [v.de, k]),
  ),
};

export function keyForPath(path: string, locale: Locale): RouteKey | null {
  const normalised = path === '' ? '/' : path.replace(/\/+$/, '') || '/';
  return pathToKey[locale].get(normalised) ?? null;
}

// Resolves equivalent path on the OTHER domain, for hreflang + language switch.
export function alternatePath(
  currentPath: string,
  currentLocale: Locale,
): { otherLocale: Locale; path: string } | null {
  const otherLocale: Locale = currentLocale === 'en' ? 'de' : 'en';
  const key = keyForPath(currentPath, currentLocale);
  if (key === null) return null;
  return { otherLocale, path: routes[key][otherLocale] };
}

// Domains — kept here so language switching can produce absolute URLs without
// the caller having to thread env vars through every component.
export function domainForLocale(locale: Locale): string {
  return locale === 'en'
    ? 'accessiblewebsite.net'
    : 'barrierefreiewebseite.net';
}
