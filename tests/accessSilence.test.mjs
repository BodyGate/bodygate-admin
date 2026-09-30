import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAccessSilence } from "../app/lib/server/accessSilence.ts";

// 2026-09-30 is CEST (UTC+2): 14:35 UTC = 16:35 Rome.
const NOW = new Date("2026-09-30T14:35:00Z");

test("recent access is ok", () => {
  const r = evaluateAccessSilence({ lastAccessAt: "2026-09-30T14:20:00Z", now: NOW });
  assert.deepEqual(r, { status: "ok", minutesSinceLastAccess: 15 });
});

test("45+ minutes of silence during opening hours warns", () => {
  const r = evaluateAccessSilence({ lastAccessAt: "2026-09-30T13:45:00Z", now: NOW });
  assert.equal(r.status, "warning");
});

test("the 30/09 incident (last access 13:33 UTC, now 14:35 UTC) warns", () => {
  const r = evaluateAccessSilence({ lastAccessAt: "2026-09-30T13:33:09Z", now: NOW });
  assert.equal(r.status, "warning");
  assert.equal(r.minutesSinceLastAccess, 61);
});

test("90+ minutes of silence is critical", () => {
  const r = evaluateAccessSilence({ lastAccessAt: "2026-09-30T12:59:00Z", now: NOW });
  assert.equal(r.status, "critical");
});

test("outside opening hours never alarms", () => {
  const night = new Date("2026-09-30T22:00:00Z"); // 00:00 Rome
  const r = evaluateAccessSilence({ lastAccessAt: "2026-09-30T10:00:00Z", now: night });
  assert.equal(r.status, "closed");
});

test("no access at all during opening hours is unknown, not ok", () => {
  assert.equal(evaluateAccessSilence({ lastAccessAt: null, now: NOW }).status, "unknown");
});
