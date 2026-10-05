// Calendar date ("YYYY-MM-DD") in the gym's timezone (Body Energy ASD, Palermo).
// Subscription / membership fee / medical certificate boundaries are plain
// `date` values entered by staff in local time, so "today" must be the local
// day, not the UTC day (`new Date().toISOString().slice(0, 10)`), which lags
// 1-2 hours behind Italy after local midnight.

const GYM_TIME_ZONE = "Europe/Rome";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: GYM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function gymToday(now: Date = new Date()): string {
  return formatter.format(now);
}
