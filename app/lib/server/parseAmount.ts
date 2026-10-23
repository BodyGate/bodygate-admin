// Parses a user-supplied euro amount ("12,50", "12.5", 12.5) into a number
// rounded to cents. Returns null for missing, non-numeric, non-positive
// values, or values that round to 0.00 (e.g. "0.001"), so a payment can
// never be recorded with a zero or sub-cent amount. Matches the rounding
// already used by renew-subscription and renew-membership-fee.
export function parseAmount(value: unknown): number | null {
  const amount = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  // Exponent notation shifts the decimal point on the decimal string, so
  // ties like 10.075 round half-up to 10.08 despite the binary float error.
  const rounded = Number(`${Math.round(Number(`${amount}e2`))}e-2`);
  return rounded > 0 ? rounded : null;
}
