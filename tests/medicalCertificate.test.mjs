import assert from "node:assert/strict";
import test from "node:test";

import { isMedicalCertificateExpiringSoon } from "../app/lib/server/medicalCertificate.ts";

const TODAY = "2026-09-09";

test("a certificate expiring today is expiring soon", () => {
  assert.equal(isMedicalCertificateExpiringSoon("2026-09-09", TODAY), true);
});

test("30 days ahead is included, 31 is not", () => {
  assert.equal(isMedicalCertificateExpiringSoon("2026-10-09", TODAY), true);
  assert.equal(isMedicalCertificateExpiringSoon("2026-10-10", TODAY), false);
});

test("already expired certificates are not expiring soon", () => {
  assert.equal(isMedicalCertificateExpiringSoon("2026-09-08", TODAY), false);
});

test("missing or malformed end dates are ignored", () => {
  assert.equal(isMedicalCertificateExpiringSoon(null, TODAY), false);
  assert.equal(isMedicalCertificateExpiringSoon("", TODAY), false);
  assert.equal(isMedicalCertificateExpiringSoon("not-a-date", TODAY), false);
});
