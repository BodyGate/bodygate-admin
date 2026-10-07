// Parses a user-supplied euro amount into a positive value rounded to cents.
// The previous per-route copies returned the raw Number(), so an amount like
// "10.005" or "0.004" reached the DB unrounded (and "0.004" passed the
// `> 0` check but is worth 0 cents). Returns null when invalid or < 0.01.
export function parseMoneyAmount(value: unknown): number | null {
  const raw = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(raw)) return null;
  const amount = Math.round((raw + Number.EPSILON) * 100) / 100;
  if (amount <= 0) return null;
  return amount;
}
