import assert from "node:assert/strict";
import test from "node:test";

import { businessDayStartISO, businessTodayISO } from "../app/lib/server/businessDate.ts";

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

test("day start is the UTC instant of Rome midnight, summer and winter", () => {
  assert.equal(businessDayStartISO(new Date("2026-07-09T22:30:00Z")), "2026-07-09T22:00:00.000Z");
  assert.equal(businessDayStartISO(new Date("2026-07-10T10:00:00Z")), "2026-07-09T22:00:00.000Z");
  assert.equal(businessDayStartISO(new Date("2026-12-10T10:00:00Z")), "2026-12-09T23:00:00.000Z");
});

test("day start is correct on the DST change days", () => {
  // 2026-10-25: clocks go back, the day starts at UTC+2 and is 25 hours long.
  assert.equal(businessDayStartISO(new Date("2026-10-25T12:00:00Z")), "2026-10-24T22:00:00.000Z");
  assert.equal(businessDayStartISO(new Date("2026-10-26T12:00:00Z")), "2026-10-25T23:00:00.000Z");
  // 2026-03-29: clocks go forward, the day starts at UTC+1.
  assert.equal(businessDayStartISO(new Date("2026-03-29T12:00:00Z")), "2026-03-28T23:00:00.000Z");
});
