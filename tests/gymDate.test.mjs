import assert from "node:assert/strict";
import test from "node:test";

import { gymTodayISO } from "../app/lib/server/gymDate.ts";

test("uses the Italian calendar day just after local midnight (CEST, UTC+2)", () => {
  // 00:30 on 2026-07-15 in Rome = 22:30 UTC on 2026-07-14
  assert.equal(gymTodayISO(new Date("2026-07-14T22:30:00Z")), "2026-07-15");
});

test("uses the Italian calendar day just after local midnight (CET, UTC+1)", () => {
  // 00:30 on 2026-12-15 in Rome = 23:30 UTC on 2026-12-14
  assert.equal(gymTodayISO(new Date("2026-12-14T23:30:00Z")), "2026-12-15");
});

test("matches the UTC day during the rest of the day", () => {
  assert.equal(gymTodayISO(new Date("2026-09-09T10:00:00Z")), "2026-09-09");
});
