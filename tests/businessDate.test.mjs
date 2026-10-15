import assert from "node:assert/strict";
import test from "node:test";

import { businessTodayISO } from "../app/lib/server/businessDate.ts";

test("uses the Rome calendar day just after local midnight in summer (UTC+2)", () => {
  // 00:30 Rome on 2026-07-10 is still 2026-07-09 in UTC.
  assert.equal(businessTodayISO(new Date("2026-07-09T22:30:00Z")), "2026-07-10");
});

test("uses the Rome calendar day just after local midnight in winter (UTC+1)", () => {
  assert.equal(businessTodayISO(new Date("2026-12-09T23:30:00Z")), "2026-12-10");
});

test("matches UTC date during the day and just before local midnight", () => {
  assert.equal(businessTodayISO(new Date("2026-07-10T10:00:00Z")), "2026-07-10");
  assert.equal(businessTodayISO(new Date("2026-07-10T21:59:00Z")), "2026-07-10");
  assert.equal(businessTodayISO(new Date("2026-07-10T22:00:00Z")), "2026-07-11");
});
