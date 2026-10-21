// Strict YYYY-MM-DD validation. `new Date("2026-02-31T00:00:00")` does not
// return Invalid Date (V8 rolls it over to 2026-03-03), so a round-trip
// check is needed to reject non-existent calendar days.
export function normalizeDateOnly(value: unknown): string | null {
  const date = String(value || "").trim();

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;

  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}
