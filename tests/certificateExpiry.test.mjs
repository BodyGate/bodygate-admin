import assert from "node:assert/strict";
import test from "node:test";
import { isCertificateExpiringWithin } from "../app/lib/server/certificateExpiry.ts";

const TODAY = "2026-10-11";

test("certificate ending today is still valid and counts as expiring", () => {
  assert.equal(isCertificateExpiringWithin("2026-10-11", TODAY), true);
});
test("certificate ending exactly in 30 days counts, 31 does not", () => {
  assert.equal(isCertificateExpiringWithin("2026-11-10", TODAY), true);
  assert.equal(isCertificateExpiringWithin("2026-11-11", TODAY), false);
});
test("already expired or missing/invalid dates do not count", () => {
  assert.equal(isCertificateExpiringWithin("2026-10-10", TODAY), false);
  assert.equal(isCertificateExpiringWithin(null, TODAY), false);
  assert.equal(isCertificateExpiringWithin("abc", TODAY), false);
});
