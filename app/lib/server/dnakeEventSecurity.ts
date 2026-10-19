// Sicurezza dell'endpoint /api/dnake/event, che puo' aprire il tornello.
//
// Il DNake non sa inviare header personalizzati: la chiave dedicata viaggia
// nell'URL (query "dnake_key"), distinta dalla chiave macchina del bridge, cosi'
// un URL trapelato non da' accesso agli altri endpoint hardware.

import { timingSafeEqual } from "node:crypto";

export const DNAKE_EVENT_KEY_PARAM = "dnake_key";

const SENSITIVE_KEYS = /key|token|secret|password|pass|authorization|cookie/i;

export function isValidDnakeEventKey(
  presented: string | null | undefined,
  configured: string | null | undefined,
): boolean {
  const expected = configured?.trim();
  const actual = presented?.trim();

  if (!expected || !actual) {
    return false;
  }

  const a = Buffer.from(actual);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item)) as unknown as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.test(key) ? "[nascosto]" : redactSensitive(item),
      ]),
    ) as T;
  }

  return value;
}

// Il lettore puo' inviare lo stesso evento piu' volte (rimbalzo, ritrasmissione):
// entro la finestra lo stesso badge non riapre e non rigenera log.
export function createBadgeDeduper(cooldownMs: number, maxKeys = 2000) {
  const seen = new Map<string, number>();

  return function isDuplicate(code: string, now: number = Date.now()): boolean {
    const last = seen.get(code);

    if (last !== undefined && now - last < cooldownMs) {
      return true;
    }

    seen.set(code, now);

    if (seen.size > maxKeys) {
      for (const [key, at] of seen) {
        if (now - at >= cooldownMs) {
          seen.delete(key);
        }
      }
    }

    return false;
  };
}
