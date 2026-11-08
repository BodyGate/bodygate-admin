/**
 * Limite ai tentativi di login. Finestra scorrevole di 15 minuti su tre livelli:
 *  - stessa email dallo stesso indirizzo IP: 5 tentativi
 *  - stessa email da qualunque IP: 25 tentativi
 *  - stesso IP verso qualunque email: 30 tentativi
 *
 * La decisione e la PRENOTAZIONE del tentativo sono un'unica operazione atomica
 * nel database (`public.reserve_login_attempt`, con advisory lock): una raffica
 * di richieste simultanee non puo' consumare tutte lo stesso margine. Un login
 * riuscito cancella i tentativi della coppia email+IP.
 *
 * Il blocco e' temporaneo, si scioglie da solo e NON si allunga: i tentativi
 * bloccati non vengono registrati. Se il database non risponde si lascia passare
 * (fail-open): un guasto del limitatore non deve chiudere fuori la palestra.
 */
export const THROTTLE_WINDOW_SECONDS = 15 * 60;
export const THROTTLE_LIMITS = { pair: 5, email: 25, ip: 30 } as const;

export type LoginKey = { email: string; ip: string };

export type ThrottleDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export interface LoginAttemptStore {
  /** Decide e, se consentito, registra il tentativo (atomico). */
  reserve(args: LoginKey & {
    windowSeconds: number;
    limitPair: number;
    limitEmail: number;
    limitIp: number;
  }): Promise<ThrottleDecision>;
  /** Cancella i tentativi della coppia email+IP dopo un accesso riuscito. */
  clear(args: LoginKey): Promise<void>;
}

export function normalizeKey(email: string, ip: string): LoginKey {
  return {
    email: email.trim().toLowerCase().slice(0, 254),
    ip: (ip.trim() || "unknown").slice(0, 64),
  };
}

export function throttleMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Troppi tentativi di accesso. Riprova tra ${minutes} ${minutes === 1 ? "minuto" : "minuti"}.`;
}

export async function reserveLoginAttempt(
  store: LoginAttemptStore,
  key: LoginKey,
): Promise<ThrottleDecision> {
  try {
    return await store.reserve({
      ...key,
      windowSeconds: THROTTLE_WINDOW_SECONDS,
      limitPair: THROTTLE_LIMITS.pair,
      limitEmail: THROTTLE_LIMITS.email,
      limitIp: THROTTLE_LIMITS.ip,
    });
  } catch (error) {
    console.error("limite login non disponibile (si lascia passare):", error instanceof Error ? error.message : "errore");
    return { allowed: true };
  }
}

export async function clearLoginFailures(store: LoginAttemptStore, key: LoginKey): Promise<void> {
  try {
    await store.clear(key);
  } catch (error) {
    console.error("azzeramento tentativi non riuscito:", error instanceof Error ? error.message : "errore");
  }
}

// IP del chiamante. Su Vercel `x-vercel-forwarded-for` e' impostato dalla piattaforma
// e non falsificabile; `x-forwarded-for` e' il ripiego (falsificabile se non c'e' un
// proxy davanti, per questo esiste anche il livello "solo email").
export function clientIpFromHeaders(get: (name: string) => string | null): string {
  const vercel = get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const forwarded = get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return get("x-real-ip")?.trim() || "unknown";
}
