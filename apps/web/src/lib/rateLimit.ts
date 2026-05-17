import { getRedis } from './queue';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Incremental rate limit: INCR a key, set EXPIRE on first hit. After the
 * window passes Redis evicts the key. Race-safe enough for an anonymous
 * scan ratelimit; we don't need a sliding window for v1.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const r = getRedis();
  const count = await r.incr(key);
  if (count === 1) {
    await r.expire(key, windowSeconds);
  }
  const ttl = await r.ttl(key);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}

/**
 * Astro's `clientAddress` reports the immediate TCP peer, which is Caddy
 * (127.0.0.1) when we're behind a reverse proxy. Read the real client IP
 * from the forwarded headers the trusted edge sets.
 *
 * Order: CF-Connecting-IP (Cloudflare) > X-Real-IP (Caddy) > leftmost
 * X-Forwarded-For > clientAddress.
 */
export function realClientIp(request: Request, clientAddress: string): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? clientAddress;
  return clientAddress;
}
