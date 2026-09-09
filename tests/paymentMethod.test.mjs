import assert from "node:assert/strict";
import test from "node:test";

import { normalizePaymentMethod } from "../app/lib/server/paymentMethod.ts";

test("accepts the three known methods", () => {
  assert.equal(normalizePaymentMethod("cash"), "cash");
  assert.equal(normalizePaymentMethod("pos"), "pos");
  assert.equal(normalizePaymentMethod("bank_transfer"), "bank_transfer");
});

test("is case-insensitive (the bug in 2 of the 4 original copies)", () => {
  assert.equal(normalizePaymentMethod("POS"), "pos");
  assert.equal(normalizePaymentMethod("Bank_Transfer"), "bank_transfer");
  assert.equal(normalizePaymentMethod("CASH"), "cash");
});

test("trims surrounding whitespace", () => {
  assert.equal(normalizePaymentMethod("  pos  "), "pos");
});

test("defaults missing/empty input to cash", () => {
  assert.equal(normalizePaymentMethod(undefined), "cash");
  assert.equal(normalizePaymentMethod(null), "cash");
  assert.equal(normalizePaymentMethod(""), "cash");
  assert.equal(normalizePaymentMethod("   "), "cash");
});

test("rejects unrecognized methods instead of silently defaulting to cash", () => {
  assert.equal(normalizePaymentMethod("credit_card"), null);
  assert.equal(normalizePaymentMethod("paypal"), null);
  assert.equal(normalizePaymentMethod("123"), null);
});
