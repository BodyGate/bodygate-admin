import assert from "node:assert/strict";
import test from "node:test";

import {
  THROTTLE_LIMITS,
  THROTTLE_WINDOW_SECONDS,
  clearLoginFailures,
  clientIpFromHeaders,
  normalizeKey,
  reserveLoginAttempt,
  throttleMessage,
} from "../app/lib/auth/loginThrottle.ts";

const key = { email: "a@b.it", ip: "1.1.1.1" };

function fakeStore({ decision = { allowed: true }, fail = false } = {}) {
  const calls = { reserve: [], clear: [] };
  return {
    calls,
    reserve: async (args) => { if (fail) throw new Error("db"); calls.reserve.push(args); return decision; },
    clear: async (k) => { if (fail) throw new Error("db"); calls.clear.push(k); },
  };
}

test("limits and window are the documented ones", () => {
  assert.deepEqual({ ...THROTTLE_LIMITS }, { pair: 5, email: 25, ip: 30 });
  assert.equal(THROTTLE_WINDOW_SECONDS, 900);
});

test("reserve passes the key and the three limits to the store (single atomic call)", async () => {
  const store = fakeStore();
  assert.deepEqual(await reserveLoginAttempt(store, key), { allowed: true });
  assert.equal(store.calls.reserve.length, 1);
  assert.deepEqual(store.calls.reserve[0], { ...key, windowSeconds: 900, limitPair: 5, limitEmail: 25, limitIp: 30 });
});

test("a blocked decision is returned as is, with the retry time", async () => {
  const d = await reserveLoginAttempt(fakeStore({ decision: { allowed: false, retryAfterSeconds: 123 } }), key);
  assert.deepEqual(d, { allowed: false, retryAfterSeconds: 123 });
});

test("reserve fails OPEN when the database is down (the gym must still be able to log in)", async () => {
  assert.deepEqual(await reserveLoginAttempt(fakeStore({ fail: true }), key), { allowed: true });
});

test("clearing never throws, even if the store is down, and passes the key", async () => {
  await clearLoginFailures(fakeStore({ fail: true }), key);
  const store = fakeStore();
  await clearLoginFailures(store, key);
  assert.deepEqual(store.calls.clear, [key]);
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
