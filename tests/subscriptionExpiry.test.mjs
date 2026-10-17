import assert from "node:assert/strict";
import test from "node:test";

import { expiryCutoffDate } from "../app/lib/server/subscriptionExpiry.ts";

test("cutoff is the date-only business day, not a timestamp", () => {
  assert.equal(expiryCutoffDate(new Date("2026-10-17T10:30:00Z")), "2026-10-17");
});

test("uses Europe/Rome day: 23:30 UTC in summer is already the next day", () => {
  assert.equal(expiryCutoffDate(new Date("2026-07-01T23:30:00Z")), "2026-07-02");
});

test("uses Europe/Rome day in winter (UTC+1)", () => {
  assert.equal(expiryCutoffDate(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
  assert.equal(expiryCutoffDate(new Date("2026-12-31T22:30:00Z")), "2026-12-31");
});
