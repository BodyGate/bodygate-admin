import assert from "node:assert/strict";
import test from "node:test";

import { parseOptionalAmount } from "../app/lib/server/optionalAmount.ts";

test("missing values mean no override", () => {
  assert.equal(parseOptionalAmount(undefined), null);
  assert.equal(parseOptionalAmount(null), null);
  assert.equal(parseOptionalAmount(""), null);
});

test("accepts dot and comma decimals, rounded to cents", () => {
  assert.equal(parseOptionalAmount("49.90"), 49.9);
  assert.equal(parseOptionalAmount("49,90"), 49.9);
  assert.equal(parseOptionalAmount(30), 30);
});

test("rejects zero, negative and non numeric values", () => {
  assert.equal(parseOptionalAmount(0), null);
  assert.equal(parseOptionalAmount("-5"), null);
  assert.equal(parseOptionalAmount("abc"), null);
  assert.equal(parseOptionalAmount("Infinity"), null);
});

test("rejects amounts that round to zero cents", () => {
  assert.equal(parseOptionalAmount("0.004"), null);
  assert.equal(parseOptionalAmount("0,001"), null);
});
