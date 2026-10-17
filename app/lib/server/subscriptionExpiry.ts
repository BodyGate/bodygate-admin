// Cutoff for the "mark expired subscriptions" job. Subscription end dates are
// inclusive (the gate in /api/access/check accepts ends_at >= today), so a
// customer is expired only when subscription_expiry is strictly before the
// current business day. Comparing against a full timestamp instead would
// treat a date-only expiry as midnight and expire the customer on their last
// valid day.
const BUSINESS_TIME_ZONE = "Europe/Rome";

export function expiryCutoffDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
