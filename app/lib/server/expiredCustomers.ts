// Pure selection logic for /api/subscriptions/check-expired.
//
// customers.subscription_expiry is a denormalized copy written only at
// contract signing; renewals (renew_subscription_atomic_v1) insert a new
// customer_subscriptions row but never refresh it. Deactivating customers
// on that stale column alone would block people who renewed and paid, so
// the real source of truth (customer_subscriptions, the same one the access
// check uses) must veto the expiry.

export type ExpiryCandidate = { id: string };

export type ActiveSubscriptionRow = { customer_id: string };

export function selectCustomersToExpire<T extends ExpiryCandidate>(
  candidates: T[],
  currentSubscriptions: ActiveSubscriptionRow[]
): T[] {
  const covered = new Set(currentSubscriptions.map((row) => row.customer_id));
  return candidates.filter((candidate) => !covered.has(candidate.id));
}
