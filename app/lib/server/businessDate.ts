// "Today" as a YYYY-MM-DD calendar date in the gym's timezone (Palermo).
// Subscription, membership-fee and medical-certificate validity columns are
// plain dates in local gym time, so comparing them against the UTC date
// (new Date().toISOString().slice(0, 10)) gives the wrong day between local
// midnight and 01:00/02:00, and differs between Vercel (UTC) and the
// reception PC (Europe/Rome).

export const BUSINESS_TIME_ZONE = "Europe/Rome";

export function businessTodayISO(now: Date = new Date()): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
