import assert from "node:assert/strict";
import test from "node:test";

import { parseAmount } from "../app/lib/server/parseAmount.ts";

test("accepts dot and comma decimals", () => {
  assert.equal(parseAmount("45.50"), 45.5);
  assert.equal(parseAmount("45,50"), 45.5);
  assert.equal(parseAmount(30), 30);
});

test("rounds to cents", () => {
  assert.equal(parseAmount("10.005"), 10.01);
  assert.equal(parseAmount("19.999"), 20);
});

test("rejects amounts that round to zero or are not positive", () => {
  assert.equal(parseAmount("0.004"), null);
  assert.equal(parseAmount("0"), null);
  assert.equal(parseAmount("-5"), null);
});

test("rejects empty and non numeric input", () => {
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount(null), null);
  assert.equal(parseAmount(undefined), null);
  assert.equal(parseAmount("abc"), null);
});
