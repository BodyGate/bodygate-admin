// Logic for /api/subscriptions/check-expired.
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

// Minimal shape of the Supabase query builder used here, so the database
// access can be tested with an in-memory fake.
type QueryResult = { data: unknown[] | null; error: { message: string } | null };

export interface QueryLike extends PromiseLike<QueryResult> {
  select(columns: string): QueryLike;
  update(values: Record<string, unknown>): QueryLike;
  lt(column: string, value: string): QueryLike;
  lte(column: string, value: string): QueryLike;
  gte(column: string, value: string): QueryLike;
  neq(column: string, value: string): QueryLike;
  eq(column: string, value: string | boolean): QueryLike;
  in(column: string, values: string[]): QueryLike;
  order(column: string, options: { ascending: boolean }): QueryLike;
  range(from: number, to: number): QueryLike;
}

export interface DbLike {
  from(table: string): QueryLike;
}

export type ExpiryRow = { id: string; subscription_expiry: string | null };

export type CheckExpiredOutcome = {
  candidates: ExpiryRow[];
  toExpire: ExpiryRow[];
  expired: ExpiryRow[];
};

export async function runExpiredCustomersCheck(
  db: DbLike,
  options: {
    nowIso: string;
    todayIso: string;
    dryRun: boolean;
    pageSize?: number;
    chunkSize?: number;
  }
): Promise<CheckExpiredOutcome> {
  const pageSize = options.pageSize ?? 1000;
  const chunkSize = options.chunkSize ?? 100;

  const fail = (message: string) => {
    throw new Error(message);
  };

  // PostgREST caps a single read (1000 rows): page through every candidate
  // with a stable order, and chunk `.in()` lists to keep URLs short.
  const candidates: ExpiryRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("customers")
      .select("id, subscription_expiry")
      .lt("subscription_expiry", options.nowIso)
      .neq("subscription_status", "expired")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) fail(error.message);

    candidates.push(...((data || []) as ExpiryRow[]));

    if (!data || data.length < pageSize) break;
  }

  const currentSubscriptions: ActiveSubscriptionRow[] = [];

  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunkIds = candidates.slice(i, i + chunkSize).map((c) => c.id);

    // A customer can hold several overlapping current rows: page through
    // them instead of capping the read, or a customer whose rows fall past
    // the cap would be expired by mistake.
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db
        .from("customer_subscriptions")
        .select("id, customer_id")
        .in("customer_id", chunkIds)
        .eq("is_active", true)
        .lte("starts_at", options.todayIso)
        .gte("ends_at", options.todayIso)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) fail(error.message);

      currentSubscriptions.push(...((data || []) as ActiveSubscriptionRow[]));

      if (!data || data.length < pageSize) break;
    }
  }

  const toExpire = selectCustomersToExpire(candidates, currentSubscriptions);
  const expired: ExpiryRow[] = [];

  // dry run only reports what would change: lets the owner see the effect
  // before the irreversible update.
  for (let i = 0; !options.dryRun && i < toExpire.length; i += chunkSize) {
    const { data, error } = await db
      .from("customers")
      .update({ subscription_status: "expired", active: false })
      .in(
        "id",
        toExpire.slice(i, i + chunkSize).map((c) => c.id)
      )
      .select("id, subscription_expiry");

    if (error) fail(error.message);

    expired.push(...((data || []) as ExpiryRow[]));
  }

  return { candidates, toExpire, expired };
}
