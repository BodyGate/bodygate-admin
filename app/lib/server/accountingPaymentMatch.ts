// Finds the row in `payments` (accounting view) that mirrors a row of
// `customer_payments`. The two tables are written in parallel with different
// ids and are only reconciled heuristically, so the match is tiered: a weaker
// tier is used only when it identifies exactly one row. A first-match-wins
// search over the OR of all criteria could pick an unrelated payment of the
// same customer/type (e.g. last month's "Abbonamento Mensile") and overwrite
// its amount/status.

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

function cents(value: unknown) {
  return Number(Number(value || 0).toFixed(2));
}

function text(value: unknown) {
  return String(value || "").trim();
}

export function findMatchingAccountingPayment<T extends PaymentLike>(
  candidates: T[],
  existing: PaymentLike & { id: string },
): T | undefined {
  const byId = candidates.filter((c) => c.id === existing.id);
  if (byId.length === 1) return byId[0];

  const existingDay = day(existing.paid_at || existing.created_at);
  const byDateAndAmount = candidates.filter(
    (c) =>
      existingDay !== "" &&
      day(c.paid_at || c.created_at) === existingDay &&
      cents(c.amount) === cents(existing.amount),
  );
  if (byDateAndAmount.length === 1) return byDateAndAmount[0];
  const description = text(existing.description);
  if (byDateAndAmount.length > 1) {
    // Same day and amount: only the description can still tell them apart.
    const narrowed = description
      ? byDateAndAmount.filter((c) => text(c.description) === description)
      : [];
    return narrowed.length === 1 ? narrowed[0] : undefined;
  }

  if (!description) return undefined;
  const byDescription = candidates.filter((c) => text(c.description) === description);
  return byDescription.length === 1 ? byDescription[0] : undefined;
}
