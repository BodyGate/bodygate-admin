import assert from "node:assert/strict";
import test from "node:test";

import { gymToday } from "../app/lib/server/gymDate.ts";

test("after local midnight (CEST) the gym day is already the next UTC-lagging day", () => {
  // 2026-07-01T22:30Z = 2026-07-02 00:30 in Palermo (UTC+2)
  assert.equal(gymToday(new Date("2026-07-01T22:30:00Z")), "2026-07-02");
});

test("after local midnight (CET) in winter", () => {
  // 2026-12-31T23:30Z = 2027-01-01 00:30 in Palermo (UTC+1)
  assert.equal(gymToday(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
});

test("midday matches the UTC date", () => {
  assert.equal(gymToday(new Date("2026-09-09T10:00:00Z")), "2026-09-09");
});

test("just before local midnight stays on the same day", () => {
  assert.equal(gymToday(new Date("2026-07-01T21:59:00Z")), "2026-07-01");
});
