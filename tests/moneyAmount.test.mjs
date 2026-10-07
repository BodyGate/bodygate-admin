import assert from "node:assert/strict";
import test from "node:test";

import { parseMoneyAmount } from "../app/lib/server/moneyAmount.ts";

test("accepts dot and comma decimals", () => {
  assert.equal(parseMoneyAmount("45"), 45);
  assert.equal(parseMoneyAmount("45,50"), 45.5);
  assert.equal(parseMoneyAmount(12.9), 12.9);
});

test("rounds to cents", () => {
  assert.equal(parseMoneyAmount("10.005"), 10.01);
  assert.equal(parseMoneyAmount("19.999"), 20);
  assert.equal(parseMoneyAmount("1.234"), 1.23);
});

test("rejects amounts worth less than one cent", () => {
  assert.equal(parseMoneyAmount("0.004"), null);
  assert.equal(parseMoneyAmount("0"), null);
  assert.equal(parseMoneyAmount("-5"), null);
});

test("rejects non-numeric input", () => {
  assert.equal(parseMoneyAmount(""), null);
  assert.equal(parseMoneyAmount(null), null);
  assert.equal(parseMoneyAmount("abc"), null);
});
