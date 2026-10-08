import assert from "node:assert/strict";
import test from "node:test";

import { parseAmount } from "../app/lib/server/parseAmount.ts";

test("accepts comma and dot decimals", () => {
  assert.equal(parseAmount("12,50"), 12.5);
  assert.equal(parseAmount("12.5"), 12.5);
  assert.equal(parseAmount(30), 30);
});

test("rounds to the cent", () => {
  assert.equal(parseAmount("12.999"), 13);
  assert.equal(parseAmount("10.123"), 10.12);
});

test("rejects sub-cent amounts that would display as 0.00", () => {
  assert.equal(parseAmount("0,004"), null);
  assert.equal(parseAmount("0.001"), null);
});

test("rejects empty, zero, negative and non-numeric values", () => {
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount(null), null);
  assert.equal(parseAmount(undefined), null);
  assert.equal(parseAmount("0"), null);
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseAmount("abc"), null);
});
