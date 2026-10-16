import assert from "node:assert/strict";
import test from "node:test";

import { isCertificateExpiringWithin } from "../app/lib/server/certificateExpiry.ts";

const NOW = new Date("2026-10-16T13:45:00Z");

test("certificate ending today is still valid and counts as expiring", () => {
  assert.equal(isCertificateExpiringWithin("2026-10-16", 30, NOW), true);
});

test("certificate ended yesterday is not expiring (already expired)", () => {
  assert.equal(isCertificateExpiringWithin("2026-10-15", 30, NOW), false);
});

test("30-day window is inclusive, day 31 is out", () => {
  assert.equal(isCertificateExpiringWithin("2026-11-15", 30, NOW), true);
  assert.equal(isCertificateExpiringWithin("2026-11-16", 30, NOW), false);
});

test("invalid or missing dates are ignored", () => {
  assert.equal(isCertificateExpiringWithin(null, 30, NOW), false);
  assert.equal(isCertificateExpiringWithin("garbage", 30, NOW), false);
});

test("uses Rome calendar day around midnight", () => {
  // 22:30 UTC on Oct 16 is already Oct 17 in Rome (CEST)
  const late = new Date("2026-10-16T22:30:00Z");
  assert.equal(isCertificateExpiringWithin("2026-10-16", 30, late), false);
  assert.equal(isCertificateExpiringWithin("2026-10-17", 30, late), true);
});

test("30-day limit is a calendar boundary across the DST end (Oct 25)", () => {
  // 00:30 Rome on Oct 16 (CEST) = 22:30Z on Oct 15
  const night = new Date("2026-10-15T22:30:00Z");
  assert.equal(isCertificateExpiringWithin("2026-11-15", 30, night), true);
  assert.equal(isCertificateExpiringWithin("2026-11-16", 30, night), false);
});
