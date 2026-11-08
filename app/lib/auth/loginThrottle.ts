/**
 * Limite ai tentativi di login. Finestra scorrevole di 15 minuti su tre livelli:
 *  - stessa email dallo stesso indirizzo IP: 5 errori
 *  - stessa email da qualunque IP: 25 errori
 *  - stesso IP verso qualunque email: 30 errori
 *
 * Il livello "email + IP" protegge senza permettere a un estraneo di bloccare il
 * titolare da un altro indirizzo; quello "solo email" ferma chi cambia IP di
 * continuo (e vale anche dove l'IP non e' affidabile, come sul PC locale senza
 * proxy); quello "solo IP" ferma chi prova molte email. Il blocco e' temporaneo
 * (si scioglie da solo) e NON si estende con i tentativi bloccati.
 *
 * Se l'archivio dei tentativi non risponde si lascia passare (fail-open): un
 * guasto del limitatore non deve impedire l'accesso alla palestra.
 */
export const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
export const THROTTLE_LIMITS = { pair: 5, email: 25, ip: 30 } as const;

export type LoginKey = { email: string; ip: string };

export type FailureTimes = {
  pair: readonly number[];
  email: readonly number[];
  ip: readonly number[];
};

export type ThrottleDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export interface LoginAttemptStore {
  failures(args: LoginKey & { sinceMs: number }): Promise<FailureTimes>;
  recordFailure(args: LoginKey): Promise<void>;
  clearFailures(args: LoginKey): Promise<void>;
}

export function normalizeKey(email: string, ip: string): LoginKey {
  return {
    email: email.trim().toLowerCase().slice(0, 254),
    ip: (ip.trim() || "unknown").slice(0, 64),
  };
}

// Istante (ms) in cui un livello si sblocca, oppure null se non e' bloccato.
function unlockAt(times: readonly number[], limit: number, now: number): number | null {
  const recent = times.filter((t) => t > now - THROTTLE_WINDOW_MS).sort((a, b) => a - b);
  if (recent.length < limit) return null;
  // Si torna sotto il limite quando scade il (n - limite + 1)-esimo errore piu' vecchio.
  return recent[recent.length - limit] + THROTTLE_WINDOW_MS;
}

export function evaluateThrottle(failures: FailureTimes, now: number): ThrottleDecision {
  const unlocks = [
    unlockAt(failures.pair, THROTTLE_LIMITS.pair, now),
    unlockAt(failures.email, THROTTLE_LIMITS.email, now),
    unlockAt(failures.ip, THROTTLE_LIMITS.ip, now),
  ].filter((value): value is number => value !== null);

  if (unlocks.length === 0) return { allowed: true };

  const retryAfterSeconds = Math.max(1, Math.ceil((Math.max(...unlocks) - now) / 1000));
  return { allowed: false, retryAfterSeconds };
}

export function throttleMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Troppi tentativi di accesso. Riprova tra ${minutes} ${minutes === 1 ? "minuto" : "minuti"}.`;
}

export async function checkLoginThrottle(
  store: LoginAttemptStore,
  key: LoginKey,
  now: number = Date.now(),
): Promise<ThrottleDecision> {
  try {
    const failures = await store.failures({ ...key, sinceMs: now - THROTTLE_WINDOW_MS });
    return evaluateThrottle(failures, now);
  } catch (error) {
    console.error("limite login non disponibile (si lascia passare):", error instanceof Error ? error.message : "errore");
    return { allowed: true };
  }
}

export async function recordLoginFailure(store: LoginAttemptStore, key: LoginKey): Promise<void> {
  try {
    await store.recordFailure(key);
  } catch (error) {
    console.error("registrazione tentativo non riuscita:", error instanceof Error ? error.message : "errore");
  }
}

export async function clearLoginFailures(store: LoginAttemptStore, key: LoginKey): Promise<void> {
  try {
    await store.clearFailures(key);
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
