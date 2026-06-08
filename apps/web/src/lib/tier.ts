import { eq, desc } from 'drizzle-orm';
import { subscriptions, users } from '@accessiblewebsite/db';
import { db } from './db';
import { isOwnerEmail } from './owner';

export type EffectiveTier = 'free' | 'gold' | 'gold_pro' | 'enterprise';

const TIER_ORDER: Record<EffectiveTier, number> = {
  free: 0,
  gold: 1,
  gold_pro: 2,
  enterprise: 3,
};

/**
 * The user's currently-billable tier. Looks at their most recent
 * subscription row; if it's `active` or `trialing` the tier sticks,
 * otherwise we fall back to 'free'. `past_due` deliberately downgrades
 * to free — feature access pauses until payment recovers.
 *
 * Special case: users whose email is in OWNER_EMAILS short-circuit to
 * `enterprise` regardless of whether they have a Stripe subscription —
 * we don't want to bill ourselves.
 */
export async function getEffectiveTier(userId: string): Promise<{
  tier: EffectiveTier;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  isOwner: boolean;
}> {
  const [userRow] = await db()
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRow && isOwnerEmail(userRow.email)) {
    return {
      tier: 'enterprise',
      status: 'owner',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      isOwner: true,
    };
  }

  const [row] = await db()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!row) {
    return {
      tier: 'free',
      status: 'none',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      isOwner: false,
    };
  }
  const isLive = row.status === 'active' || row.status === 'trialing';
  return {
    tier: isLive ? (row.tier as EffectiveTier) : 'free',
    status: row.status,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodEnd: row.currentPeriodEnd,
    isOwner: false,
  };
}

export function tierIncludes(actual: EffectiveTier, required: EffectiveTier): boolean {
  return TIER_ORDER[actual] >= TIER_ORDER[required];
}
