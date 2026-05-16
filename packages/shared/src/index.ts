import { z } from 'zod';

// =============================================================================
// Locale
// =============================================================================

export const Locale = z.enum(['en', 'de']);
export type Locale = z.infer<typeof Locale>;

export const LOCALES = ['en', 'de'] as const;

// =============================================================================
// URL — normalised to a safe shape before storage / scanning
// =============================================================================

export const ScanTargetUrl = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .transform((raw, ctx) => {
    let candidate = raw;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    }
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid URL' });
      return z.NEVER;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only http(s) URLs are supported',
      });
      return z.NEVER;
    }
    // Strip credentials, hash, and obvious tracking params
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    return parsed.toString();
  });

// =============================================================================
// API boundary schemas
// =============================================================================

export const ScanInitiateInput = z.object({
  url: ScanTargetUrl,
  email: z.string().email().optional(),
  language: Locale.optional(),
});
export type ScanInitiateInput = z.infer<typeof ScanInitiateInput>;

export const QuoteRequestInput = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: z.string().email(),
  companyName: z.string().trim().max(200).optional(),
  websiteUrl: ScanTargetUrl,
  platformCms: z.enum(['wordpress', 'shopify', 'webflow', 'custom', 'other']),
  estimatedPages: z.enum(['lt10', '10_50', '50_250', 'gt250']),
  urgency: z.enum(['standard', 'rush']),
  message: z.string().trim().max(5000).optional(),
  language: Locale,
  gdprConsent: z.coerce.boolean().refine((v) => v === true, {
    message: 'GDPR consent is required',
  }),
});
export type QuoteRequestInput = z.infer<typeof QuoteRequestInput>;

export const NewsletterSubscribeInput = z.object({
  email: z.string().email(),
  language: Locale,
  source: z.string().max(100).optional(),
});

// =============================================================================
// Scan results — wire format from scanner -> web
// =============================================================================

export const WcagSeverity = z.enum(['critical', 'serious', 'moderate', 'minor']);
export type WcagSeverity = z.infer<typeof WcagSeverity>;

export const ScanViolation = z.object({
  pageUrl: z.string().url(),
  wcagCriterion: z.string().min(1).max(16),
  severity: WcagSeverity,
  elementSelector: z.string().optional(),
  description: z.string(),
  remediationHint: z.string().optional(),
});
export type ScanViolation = z.infer<typeof ScanViolation>;

export const ScanResultPayload = z.object({
  scanId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  totalIssues: z.number().int().nonnegative(),
  bySeverity: z.object({
    critical: z.number().int().nonnegative(),
    serious: z.number().int().nonnegative(),
    moderate: z.number().int().nonnegative(),
    minor: z.number().int().nonnegative(),
  }),
  violations: z.array(ScanViolation),
});
export type ScanResultPayload = z.infer<typeof ScanResultPayload>;

// =============================================================================
// BullMQ job payloads
// =============================================================================

export const ScanJobPayload = z.object({
  scanId: z.string().uuid(),
  targetUrl: z.string().url(),
  scanType: z.enum(['homepage', 'full_site']),
  maxPages: z.number().int().min(1).max(2500).default(1),
  triggeredBy: z.enum(['user', 'cron', 'post_remediation', 'anonymous']),
});
export type ScanJobPayload = z.infer<typeof ScanJobPayload>;

// BullMQ v5 disallows ':' in queue names (it's their internal Redis key
// delimiter). Use '-' as the brand-prefix separator instead.
export const QUEUE_NAMES = {
  scan: 'accessiblewebsite-scan',
  email: 'accessiblewebsite-email',
} as const;
