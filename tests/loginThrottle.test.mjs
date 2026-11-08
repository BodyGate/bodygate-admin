import assert from "node:assert/strict";
import test from "node:test";

import {
  THROTTLE_LIMITS,
  THROTTLE_WINDOW_MS,
  checkLoginThrottle,
  clearLoginFailures,
  clientIpFromHeaders,
  evaluateThrottle,
  normalizeKey,
  recordLoginFailure,
  throttleMessage,
} from "../app/lib/auth/loginThrottle.ts";

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const none = { pair: [], email: [], ip: [] };
// n errori distribuiti ogni 10 secondi, l'ultimo "ago" ms fa
const burst = (n, ago = 1000) => Array.from({ length: n }, (_, i) => NOW - ago - (n - 1 - i) * 10_000);

test("below every limit the login is allowed", () => {
  const f = { pair: burst(4), email: burst(24), ip: burst(29) };
  assert.deepEqual(evaluateThrottle(f, NOW), { allowed: true });
});

test("5 failures for the same email+IP block, and unblock when the oldest leaves the window", () => {
  const pair = [NOW - 14 * MIN, NOW - 10 * MIN, NOW - 5 * MIN, NOW - 2 * MIN, NOW - MIN];
  const d = evaluateThrottle({ ...none, pair, email: pair }, NOW);
  assert.equal(d.allowed, false);
  // il piu' vecchio (14 min fa) esce dalla finestra tra 1 minuto
  assert.equal(d.retryAfterSeconds, 60);
});

test("a blocked attempt does not extend the lock (only recorded failures count)", () => {
  // stesso scenario di sopra, 30 secondi dopo: il tempo residuo scende, non si allunga
  const pair = [NOW - 14 * MIN, NOW - 10 * MIN, NOW - 5 * MIN, NOW - 2 * MIN, NOW - MIN];
  const later = evaluateThrottle({ ...none, pair }, NOW + 30_000);
  assert.equal(later.allowed, false);
  assert.equal(later.retryAfterSeconds, 30);
});

test("failures older than the window are ignored", () => {
  const old = burst(10, THROTTLE_WINDOW_MS + 1000);
  assert.deepEqual(evaluateThrottle({ pair: old, email: old, ip: old }, NOW), { allowed: true });
});

test("a stranger from another IP cannot lock the owner out with the pair limit alone", () => {
  // 10 errori dell'estraneo sono per (email, IP-estraneo): per il titolare la coppia e' vuota
  const owner = { pair: [], email: burst(10), ip: [] };
  assert.deepEqual(evaluateThrottle(owner, NOW), { allowed: true });
});

test("rotating IPs is stopped by the per-email limit; scanning many emails by the per-IP limit", () => {
  assert.equal(evaluateThrottle({ ...none, email: burst(THROTTLE_LIMITS.email) }, NOW).allowed, false);
  assert.equal(evaluateThrottle({ ...none, ip: burst(THROTTLE_LIMITS.ip) }, NOW).allowed, false);
});

test("the lock lasts until ALL tripped levels are free", () => {
  const pair = burst(5, 14 * MIN); // il piu' vecchio esce tra ~20 secondi
  const ip = burst(30, 1000); // il piu' vecchio (291 s fa) esce tra 609 secondi
  assert.equal(evaluateThrottle({ pair, email: [], ip: [] }, NOW).retryAfterSeconds, 20);
  assert.equal(evaluateThrottle({ pair: [], email: [], ip }, NOW).retryAfterSeconds, 609);
  const both = evaluateThrottle({ pair, email: [], ip }, NOW);
  assert.equal(both.allowed, false);
  assert.equal(both.retryAfterSeconds, 609); // vale il livello che si sblocca per ultimo
});

test("message is in Italian with minutes rounded up", () => {
  assert.equal(throttleMessage(1), "Troppi tentativi di accesso. Riprova tra 1 minuto.");
  assert.equal(throttleMessage(61), "Troppi tentativi di accesso. Riprova tra 2 minuti.");
});

test("key is normalised and bounded", () => {
  assert.deepEqual(normalizeKey("  Titolare@Example.COM ", " 1.2.3.4 "), { email: "titolare@example.com", ip: "1.2.3.4" });
  assert.equal(normalizeKey("x".repeat(500), "y".repeat(500)).email.length, 254);
  assert.equal(normalizeKey("a@b.it", "y".repeat(500)).ip.length, 64);
  assert.equal(normalizeKey("a@b.it", "  ").ip, "unknown");
});

test("client IP prefers the platform header, then x-forwarded-for, then x-real-ip", () => {
  const h = (map) => (name) => map[name] ?? null;
  assert.equal(clientIpFromHeaders(h({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "1.1.1.1" })), "9.9.9.9");
  assert.equal(clientIpFromHeaders(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "1.1.1.1");
  assert.equal(clientIpFromHeaders(h({ "x-real-ip": "3.3.3.3" })), "3.3.3.3");
  assert.equal(clientIpFromHeaders(h({})), "unknown");
});

function fakeStore({ failures = none, failRead = false, failWrite = false } = {}) {
  const calls = { record: [], clear: [] };
  return {
    calls,
    failures: async () => { if (failRead) throw new Error("db"); return failures; },
    recordFailure: async (k) => { if (failWrite) throw new Error("db"); calls.record.push(k); },
    clearFailures: async (k) => { if (failWrite) throw new Error("db"); calls.clear.push(k); },
  };
}
const key = { email: "a@b.it", ip: "1.1.1.1" };

test("checkLoginThrottle blocks when the store reports too many failures", async () => {
  const d = await checkLoginThrottle(fakeStore({ failures: { ...none, pair: burst(5) } }), key, NOW);
  assert.equal(d.allowed, false);
});

test("checkLoginThrottle fails OPEN when the store is down (the gym must still be able to log in)", async () => {
  const d = await checkLoginThrottle(fakeStore({ failRead: true }), key, NOW);
  assert.deepEqual(d, { allowed: true });
});

test("recording and clearing never throw, even if the store is down", async () => {
  const store = fakeStore({ failWrite: true });
  await recordLoginFailure(store, key);
  await clearLoginFailures(store, key);
});

test("record and clear pass the normalised key to the store", async () => {
  const store = fakeStore();
  await recordLoginFailure(store, key);
  await clearLoginFailures(store, key);
  assert.deepEqual(store.calls.record, [key]);
  assert.deepEqual(store.calls.clear, [key]);
});
