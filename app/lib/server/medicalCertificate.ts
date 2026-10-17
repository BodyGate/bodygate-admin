// A certificate is "expiring soon" from the day it expires (still valid at the
// turnstile, see accessEligibility.ts) up to `days` days ahead. Compared as
// YYYY-MM-DD strings: parsing the end date into a Date gives midnight UTC,
// which is already in the past for a certificate that expires today.
export function isMedicalCertificateExpiringSoon(
  endDate: string | null | undefined,
  today: string,
  days = 30,
): boolean {
  const end = String(endDate || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;

  const limit = new Date(`${today}T00:00:00Z`);

  if (Number.isNaN(limit.getTime())) return false;

  limit.setUTCDate(limit.getUTCDate() + days);

  return end >= today && end <= limit.toISOString().slice(0, 10);
}
