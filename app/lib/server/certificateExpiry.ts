// Pure helper for the "certificati in scadenza" counter of /api/customers/list.
// Dates are compared as calendar days (YYYY-MM-DD, Europe/Rome), consistent with
// accessEligibility (certificate valid through its end date, inclusive).

const GYM_TIME_ZONE = "Europe/Rome";

function romeDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: GYM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isCertificateExpiringWithin(
  endDate: string | null | undefined,
  days: number,
  now: Date = new Date(),
) {
  const end = String(endDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;

  const today = romeDay(now);
  const limit = romeDay(new Date(now.getTime() + days * 86400000));

  return end >= today && end <= limit;
}
