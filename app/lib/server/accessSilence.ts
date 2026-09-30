// Detects a silent turnstile: the DNake controller can stop recording badge
// taps without any error reaching BodyGate (30/09/2026: no event after 15:33,
// bridge still "alive"). During opening hours a long gap since the last
// recorded access is the only signal we have, so surface it.

export type AccessSilenceStatus = "ok" | "warning" | "critical" | "closed" | "unknown";

export const SILENCE_WARNING_MINUTES = 45;
export const SILENCE_CRITICAL_MINUTES = 90;
export const OPENING_HOUR = 6;
export const CLOSING_HOUR = 23;

export type AccessSilenceResult = {
  status: AccessSilenceStatus;
  minutesSinceLastAccess: number | null;
};

function romeHour(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "Europe/Rome",
    }).format(date)
  );
}

export function evaluateAccessSilence(params: {
  lastAccessAt: string | Date | null | undefined;
  now: Date;
}): AccessSilenceResult {
  const { lastAccessAt, now } = params;
  const hour = romeHour(now);

  if (hour < OPENING_HOUR || hour >= CLOSING_HOUR) {
    return { status: "closed", minutesSinceLastAccess: null };
  }

  const last = lastAccessAt ? new Date(lastAccessAt) : null;
  if (!last || Number.isNaN(last.getTime())) {
    return { status: "unknown", minutesSinceLastAccess: null };
  }

  const minutes = Math.max(0, Math.floor((now.getTime() - last.getTime()) / 60_000));

  if (minutes >= SILENCE_CRITICAL_MINUTES) return { status: "critical", minutesSinceLastAccess: minutes };
  if (minutes >= SILENCE_WARNING_MINUTES) return { status: "warning", minutesSinceLastAccess: minutes };
  return { status: "ok", minutesSinceLastAccess: minutes };
}
