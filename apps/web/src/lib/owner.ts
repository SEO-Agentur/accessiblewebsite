import { env } from '../env';

let _cached: Set<string> | null = null;

/**
 * Parse OWNER_EMAILS (comma-separated) into a lowercase set, cached on the
 * first call. Empty / unset env var → empty set.
 */
function ownerEmails(): Set<string> {
  if (_cached) return _cached;
  const raw = env().OWNER_EMAILS ?? '';
  _cached = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0),
  );
  return _cached;
}

/**
 * Returns true when the given email is in OWNER_EMAILS. Owners get
 * unconditional Enterprise-tier access:
 *   - no Stripe subscription required for tier-gated features
 *   - their public monitored_sites always appear in /verified regardless
 *     of subscription state
 *   - anonymous-scan rate limits bypassed while their session is active
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmails().has(email.toLowerCase());
}

/** Return the raw lowercased list — useful for SQL `email IN (...)` filters. */
export function getOwnerEmailList(): string[] {
  return [...ownerEmails()];
}
