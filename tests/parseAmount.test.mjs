import assert from "node:assert/strict";
import test from "node:test";

import { parseAmount } from "../app/lib/server/parseAmount.ts";

test("accepts comma and dot decimals", () => {
  assert.equal(parseAmount("12,50"), 12.5);
  assert.equal(parseAmount("12.5"), 12.5);
  assert.equal(parseAmount(40), 40);
});

test("rounds to cents instead of storing fractions of a cent", () => {
  assert.equal(parseAmount("10.005"), 10.01);
  assert.equal(parseAmount("19.999"), 20);
});

test("rejects sub-cent, zero, negative and invalid values", () => {
  assert.equal(parseAmount("0.001"), null);
  assert.equal(parseAmount("0"), null);
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount(null), null);
  assert.equal(parseAmount("abc"), null);
});
