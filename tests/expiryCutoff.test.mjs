import assert from "node:assert/strict";
import test from "node:test";

import { expiryCutoffDate } from "../app/lib/server/expiryCutoff.ts";

test("returns the Rome calendar date, not the UTC one", () => {
  // 23:30 UTC on 6 Oct is already 7 Oct in Palermo (CEST, UTC+2)
  assert.equal(expiryCutoffDate(new Date("2026-10-06T23:30:00Z")), "2026-10-07");
});

test("winter time (CET, UTC+1)", () => {
  assert.equal(expiryCutoffDate(new Date("2026-01-15T22:59:00Z")), "2026-01-15");
  assert.equal(expiryCutoffDate(new Date("2026-01-15T23:00:00Z")), "2026-01-16");
});
