// Picks the `payments` (accounting) row that mirrors a `customer_payments`
// row being rectified. The two tables are written in parallel and are only
// linked heuristically, so a wrong pick overwrites the amount of an unrelated
// payment. Extracted from app/api/customers/update-payment/route.ts so the
// matching can be unit tested without mocking Supabase.

export type PaymentLike = {
  id?: string | null;
  amount?: unknown;
  description?: unknown;
  paid_at?: unknown;
  created_at?: unknown;
};

function day(value: unknown) {
  return String(value || "").slice(0, 10);
}

function text(value: unknown) {
  return String(value || "").trim();
}

function sameAmount(a: unknown, b: unknown) {
  return Number(a || 0).toFixed(2) === Number(b || 0).toFixed(2);
}

// Priority: exact id, then same day + same amount, then same description only
// when it identifies a single candidate. Returns null when nothing can be
// matched with confidence (the accounting row is then left untouched rather
// than risk rewriting another payment).
export function findMatchingAccountingPayment<T extends PaymentLike>(
  candidates: T[],
  existing: PaymentLike & { id: string },
): T | null {
  const byId = candidates.find((payment) => payment.id === existing.id);
  if (byId) return byId;

  const existingDay = day(existing.paid_at || existing.created_at);
  const byDayAndAmount = candidates.find(
    (payment) =>
      existingDay !== "" &&
      day(payment.paid_at || payment.created_at) === existingDay &&
      sameAmount(payment.amount, existing.amount),
  );
  if (byDayAndAmount) return byDayAndAmount;

  const description = text(existing.description);
  if (!description) return null;

  const byDescription = candidates.filter(
    (payment) => text(payment.description) === description,
  );
  return byDescription.length === 1 ? byDescription[0] : null;
}
