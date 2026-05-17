import { z } from 'zod';

const EnvSchema = z.preprocess(
  // Treat empty strings as undefined so optional/default fields work even
  // when .env has `SENTRY_DSN=` (a literal empty value). Without this,
  // z.string().url().optional() rejects "" before .optional() applies.
  (input) => {
    if (typeof input !== 'object' || input === null) return input;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = typeof v === 'string' && v.trim() === '' ? undefined : v;
    }
    return out;
  },
  z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    PUBLIC_SITE_URL_EN: z.string().url().default('https://accessiblewebsite.net'),
    PUBLIC_SITE_URL_DE: z.string().url().default('https://barrierefreiewebseite.net'),

    SESSION_SECRET: z.string().min(32),
    SEAL_JWT_SECRET: z.string().min(32),

    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EN: z.string().email().default('team@accessiblewebsite.net'),
    RESEND_FROM_DE: z.string().email().default('team@barrierefreiewebseite.net'),

    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    SENTRY_DSN: z.string().url().optional(),

    SCAN_RATE_ANONYMOUS_PER_HOUR: z.coerce.number().int().min(1).default(3),
    SCAN_RATE_FREE_PER_DAY: z.coerce.number().int().min(1).default(10),
    SCAN_GOLD_MAX_PAGES: z.coerce.number().int().min(1).default(250),
    SCAN_GOLD_PRO_MAX_PAGES: z.coerce.number().int().min(1).default(2500),

    // Operator imprint data. Until COMPANY_NAME is set, the imprint page
    // renders an admin warning instead of fake company details.
    COMPANY_NAME: z.string().optional(),
    COMPANY_ADDRESS_LINE_1: z.string().optional(),
    COMPANY_ADDRESS_LINE_2: z.string().optional(),
    COMPANY_POSTAL_CITY: z.string().optional(),
    COMPANY_COUNTRY: z.string().optional(),
    COMPANY_MANAGING_DIRECTOR: z.string().optional(),
    COMPANY_REGISTRY_COURT: z.string().optional(),
    COMPANY_REGISTRY_NUMBER: z.string().optional(),
    COMPANY_VAT_ID: z.string().optional(),
    COMPANY_CONTACT_EMAIL: z.string().email().optional(),
  }),
);

export type Env = z.infer<typeof EnvSchema>;

let _cached: Env | null = null;
export function env(): Env {
  if (_cached) return _cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      'Invalid environment variables:\n',
      JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    );
    throw new Error('Environment validation failed');
  }
  _cached = parsed.data;
  return _cached;
}
