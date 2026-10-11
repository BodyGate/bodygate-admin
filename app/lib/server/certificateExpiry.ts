// Pure date-only check used by the customers list "in scadenza" counter.
// medical_certificate_end_date is a DATE column (YYYY-MM-DD): comparing it as
// a string against today's date keeps it consistent with the access gate
// (app/api/access/check, which treats end >= today as still valid). Parsing it
// with new Date() yields UTC midnight, which is already "in the past" for the
// whole of the last valid day.

export function isCertificateExpiringWithin(
  endDate: string | null | undefined,
  today: string,
  days = 30
): boolean {
  const end = String(endDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;

  const [y, m, d] = today.split("-").map(Number);
  const limit = new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);

  return end >= today && end <= limit;
}
