// Parses a user-supplied euro amount ("12,50", "12.5", 12.5) into a positive
// number rounded to the cent, or null if invalid. Rounding happens BEFORE the
// positivity check so that sub-cent inputs such as "0,004" are rejected
// instead of being stored as a payment that displays as €0.00.
export function parseAmount(value: unknown): number | null {
  const amount = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  // toPrecision(15) strips binary float noise so ties round half-up
  // ("2.675" -> 2.68, whereas toFixed(2) would give 2.67).
  const rounded = Math.round(Number((amount * 100).toPrecision(15))) / 100;
  if (rounded <= 0) return null;
  return rounded;
}
