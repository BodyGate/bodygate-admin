// Parses an optional euro amount sent by the client. Returns null when the
// value is missing or not a valid positive amount *after* rounding to cents:
// "0.004" is > 0 as a number but rounds to 0.00, and must not be forwarded
// to the renewal RPC as a (zero-euro) price override.
export function parseOptionalAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;

  const amount = Number(String(value).replace(",", "."));

  if (!Number.isFinite(amount) || amount <= 0) return null;

  const rounded = Number(amount.toFixed(2));

  return rounded > 0 ? rounded : null;
}
