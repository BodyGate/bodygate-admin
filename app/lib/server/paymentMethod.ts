export type PaymentMethod = "cash" | "pos" | "bank_transfer";

const VALID_METHODS: readonly PaymentMethod[] = ["cash", "pos", "bank_transfer"];

// Consolidates 4 near-duplicate implementations that had drifted apart
// (found while adding test coverage): two didn't lowercase the input, so
// "POS" or "Bank_Transfer" silently failed to match, and one of the four
// coerced any unrecognized value to "cash" instead of rejecting it -
// meaning a mistyped or unsupported payment method could be recorded as a
// cash payment. This version never guesses: unrecognized input returns
// null so the caller can reject it, and empty/missing input defaults to
// "cash" (the previous behavior in 3 of the 4 call sites).
export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  const method = String(value ?? "").trim().toLowerCase() || "cash";

  return (VALID_METHODS as readonly string[]).includes(method)
    ? (method as PaymentMethod)
    : null;
}
