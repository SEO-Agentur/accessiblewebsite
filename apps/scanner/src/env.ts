import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // How many scans run in parallel. 2 fits comfortably in the VPS RAM
  // budget (~1.6 GB peak across both Chromium contexts).
  SCANNER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(2),

  // Per-step timeouts. Tuned so a homepage scan can never wedge a worker
  // for more than ~90s total. Floor is generous-low so operators can drop
  // it to a sub-second value to deliberately force a Firecrawl failover
  // during testing.
  SCANNER_GOTO_TIMEOUT_MS: z.coerce.number().int().min(100).default(25_000),
  SCANNER_AUDIT_TIMEOUT_MS: z.coerce.number().int().min(100).default(30_000),
  SCANNER_JOB_TIMEOUT_MS: z.coerce.number().int().min(15_000).default(90_000),

  // How often the watchdog sweeps scans that have been stuck too long.
  SCANNER_WATCHDOG_INTERVAL_MS: z.coerce.number().int().min(10_000).default(60_000),
  SCANNER_STALLED_AFTER_MS: z.coerce.number().int().min(60_000).default(5 * 60_000),

  // Firecrawl failover. When the primary Playwright scanner fails to load
  // any pages for a scan, the worker retries via Firecrawl (rendered HTML +
  // axe-core in JSDOM, with browser-only rules disabled). Unset = disabled.
  FIRECRAWL_API_KEY: z.string().optional(),
  FIRECRAWL_TIMEOUT_MS: z.coerce.number().int().min(5_000).default(45_000),
  PARTIAL_SCAN_SCORE_CAP: z.coerce.number().int().min(0).max(100).default(80),
});

let _cached: z.infer<typeof EnvSchema> | null = null;
export function env(): z.infer<typeof EnvSchema> {
  if (_cached) return _cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      'Invalid scanner environment:\n',
      JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    );
    process.exit(1);
  }
  _cached = parsed.data;
  return _cached;
}
