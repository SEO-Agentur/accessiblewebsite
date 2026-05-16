import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SCANNER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  SCANNER_PAGE_TIMEOUT_MS: z.coerce.number().int().min(5000).default(30000),
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
