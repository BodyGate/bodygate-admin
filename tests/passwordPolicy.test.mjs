import assert from "node:assert/strict";
import test from "node:test";

import { MAX_PASSWORD_BYTES, validateNewPassword } from "../app/lib/auth/passwordPolicy.ts";

const ok = (next, extra = {}) => validateNewPassword({ current: "vecchia-password-1", next, email: "titolare@example.com", ...extra });

test("accepts a long, varied password", () => {
  assert.equal(ok("Tre-cavalli-blu-sul-ponte-7"), null);
});

test("rejects short passwords", () => {
  assert.match(ok("Corta1!"), /almeno 12/);
});

test("rejects passwords longer than bcrypt can use (72 bytes)", () => {
  const varied = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // 62
  assert.equal(ok(varied + "!?-_.,;:*+"), null); // 72 byte esatti
  assert.match(ok(varied + "!?-_.,;:*+X"), /troppo lunga/); // 73 byte
  // Multibyte: meno di 72 caratteri ma piu' di 72 byte.
  const multibyte = "àèéìòùÀÈÉÌÒÙ" + "abcdefghijklmnopqrstuvwxyz" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; // 64 caratteri, 76 byte
  assert.ok(multibyte.length <= 72);
  assert.match(ok(multibyte), /troppo lunga/);
  assert.equal(MAX_PASSWORD_BYTES, 72);
});

test("rejects the same password as the current one", () => {
  assert.match(validateNewPassword({ current: "Tre-cavalli-blu-7", next: "Tre-cavalli-blu-7" }), /diversa/);
});

test("rejects trivial repetition and obvious choices", () => {
  assert.match(ok("aaaaaaaaaaaa"), /semplice/);
  assert.match(ok("111111111111"), /semplice/);
  assert.match(ok("Password1234!!"), /comune/);
  assert.match(ok("BodyGate-2026-26"), /comune/);
  assert.match(ok("ADMIN123456789"), /comune/);
});

test("rejects a password containing the email local part", () => {
  assert.match(ok("xx-titolare-yy-77"), /email/);
  assert.equal(ok("xx-titolare-yy-77", { email: "ab@example.com" }), null); // parte locale troppo corta per contare
});
