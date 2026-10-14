// "Today" as a YYYY-MM-DD string in the gym's timezone (Palermo, Europe/Rome).
//
// Date-only columns (customer_subscriptions.starts_at/ends_at,
// customer_membership_fees.valid_from/valid_until, medical certificate dates)
// are calendar days in Italian local time. `new Date().toISOString().slice(0, 10)`
// yields the UTC day, which lags Italy by 1-2 hours: between local midnight and
// 01:00/02:00 it still returns "yesterday".

export const GYM_TIME_ZONE = "Europe/Rome";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: GYM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function gymTodayISO(now: Date = new Date()): string {
  return dayFormatter.format(now);
}
