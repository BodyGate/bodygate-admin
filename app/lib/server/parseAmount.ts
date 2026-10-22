// Parses a user-supplied euro amount. Returns null for anything that is not
// a strictly positive amount once rounded to cents. The result is always
// rounded to 2 decimals so the value written to the DB, the receipt and the
// timeline text ("€x.xx") are the same number. Previously payments/create
// and update-payment returned the raw float: "10.005" was stored unrounded
// and "0.004" passed the `> 0` check but rounds to 0.00 in numeric(_,2).
export function parseAmount(value: unknown): number | null {
  const amount = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(amount)) return null;

  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  if (rounded <= 0) return null;

  return rounded;
}
