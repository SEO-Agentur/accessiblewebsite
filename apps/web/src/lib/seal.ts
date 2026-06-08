/**
 * Seal SVG generation. Renders a 200x64 embeddable badge in one of four
 * states: gold (score >=95), silver (score >=80), bronze (score >=70), or
 * expired (no passing scan in last 90 days).
 *
 * Kept as a pure function so the API route can call it without per-request
 * imports of templating libraries.
 */

export type SealTier = 'gold' | 'silver' | 'bronze' | 'expired';

export const SEAL_VALIDITY_DAYS = 90;

const TIER_CONFIG: Record<
  SealTier,
  {
    accent: string;
    accentDark: string;
    labelEn: string;
    labelDe: string;
    subEn: string;
    subDe: string;
    inkText: string;
    inkSub: string;
  }
> = {
  gold: {
    accent: '#e0b948',
    accentDark: '#a07c1f',
    labelEn: 'GOLD',
    labelDe: 'GOLD',
    subEn: 'Seal',
    subDe: 'Siegel',
    inkText: '#1f1f24',
    inkSub: '#4a4a52',
  },
  silver: {
    accent: '#d4d4d8',
    accentDark: '#71717a',
    labelEn: 'SILVER',
    labelDe: 'SILBER',
    subEn: 'Seal',
    subDe: 'Siegel',
    inkText: '#1f1f24',
    inkSub: '#52525b',
  },
  // Warm coppery tone — distinguishable from gold at a glance, not so
  // muddy that it reads as "broken".
  bronze: {
    accent: '#d49b6a',
    accentDark: '#8b5a2b',
    labelEn: 'BRONZE',
    labelDe: 'BRONZE',
    subEn: 'Seal',
    subDe: 'Siegel',
    inkText: '#1f1f24',
    inkSub: '#52525b',
  },
  expired: {
    accent: '#e5e7eb',
    accentDark: '#9ca3af',
    labelEn: 'EXPIRED',
    labelDe: 'ABGELAUFEN',
    subEn: 'Re-scan',
    subDe: 'Neu prüfen',
    inkText: '#374151',
    inkSub: '#6b7280',
  },
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function escapeSvgText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Month/year stamp like "MAY '26" / "MAI '26" — short enough to fit on the
// right-hand tier panel, makes screenshots of stale seals visibly stale.
function monthYearStamp(at: Date | null, locale: 'en' | 'de'): string {
  const d = at ?? new Date();
  const month = (
    locale === 'de'
      ? ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ']
      : ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  )[d.getUTCMonth()];
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${month} '${yy}`;
}

export function renderSealSvg(
  tier: SealTier,
  domain: string,
  locale: 'en' | 'de',
  verifiedAt: Date | null = null,
): string {
  const cfg = TIER_CONFIG[tier];
  const tierLabel = locale === 'de' ? cfg.labelDe : cfg.labelEn;
  const subLabel = locale === 'de' ? cfg.subDe : cfg.subEn;
  const verifiedLabel = locale === 'de' ? 'Verifiziert' : 'Verified';
  const stamp = monthYearStamp(verifiedAt, locale);
  const title =
    tier === 'expired'
      ? `WCAG 2.2 AA — ${tierLabel} — ${domain}`
      : `WCAG 2.2 AA ${tierLabel} — ${domain} — ${stamp}`;
  const safeDomain = escapeSvgText(truncate(domain, 22));
  const safeTitle = escapeSvgText(title);
  const safeStamp = escapeSvgText(stamp);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="64" viewBox="0 0 200 64" role="img" aria-label="${safeTitle}">
  <title>${safeTitle}</title>
  <defs>
    <linearGradient id="tier" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${cfg.accent}"/>
      <stop offset="100%" stop-color="${cfg.accentDark}"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#172554"/>
    </linearGradient>
  </defs>
  <rect width="200" height="64" rx="8" fill="url(#brand)"/>
  <rect x="130" width="70" height="64" rx="8" fill="url(#tier)"/>
  <rect x="130" width="8" height="64" fill="url(#tier)"/>
  <g font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="700">
    <text x="14" y="22" font-size="12" fill="white">WCAG 2.2 AA</text>
    <text x="14" y="38" font-size="10" font-weight="500" fill="#bfd0f4">${verifiedLabel}</text>
    <text x="14" y="54" font-size="9" font-weight="400" fill="#8da3d4">${safeDomain}</text>
    <text x="165" y="28" font-size="12" font-weight="800" fill="${cfg.inkText}" text-anchor="middle">${tierLabel}</text>
    <text x="165" y="42" font-size="8" font-weight="500" fill="${cfg.inkSub}" text-anchor="middle">${subLabel}</text>
    <text x="165" y="55" font-size="8" font-weight="700" fill="${cfg.inkText}" text-anchor="middle" letter-spacing="0.5">${safeStamp}</text>
  </g>
</svg>`;
}

export type SealEarnedTier = 'gold' | 'silver' | 'bronze';

export function tierFromScore(score: number | null | undefined): SealEarnedTier | null {
  if (typeof score !== 'number') return null;
  if (score >= 95) return 'gold';
  if (score >= 80) return 'silver';
  if (score >= 70) return 'bronze';
  return null;
}

/** Lowest score that earns a place in the public directory. */
export const MIN_DIRECTORY_SCORE = 70;
