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

function zoneOffsetMs(instant: number): number {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(instant))
    .find((p) => p.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part || "");
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}

// UTC instant (ISO string) of 00:00 on the business day. Use it to filter
// timestamp columns; businessTodayISO() is only for date-only columns.
export function businessDayStartISO(now: Date = new Date()): string {
  const [year, month, day] = businessTodayISO(now).split("-").map(Number);
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  let instant = localMidnightAsUtc - zoneOffsetMs(localMidnightAsUtc);
  instant = localMidnightAsUtc - zoneOffsetMs(instant);
  return new Date(instant).toISOString();
}
