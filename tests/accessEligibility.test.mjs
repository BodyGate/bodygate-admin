import assert from "node:assert/strict";
import test from "node:test";

// Compiled via ts-node-free approach: import the TS source directly is not
// possible from a plain .mjs test without a loader, so this test drives the
// same logic through the app's tsconfig-aware test runner entry point.
// See package.json's "qa:access-eligibility" script, which uses `node
// --experimental-strip-types` (Node 22+, matches the CI node-version) to run
// this file directly against the .ts source with zero build step.
import { evaluateAccessEligibility } from "../app/lib/server/accessEligibility.ts";

const TODAY = "2026-09-09";

function baseCustomer(overrides = {}) {
  return {
    is_active: true,
    branch_id: "branch-1",
    medical_certificate_start_date: "2026-01-01",
    medical_certificate_end_date: "2027-01-01",
    medical_certificate_status: "valid",
    ...overrides,
  };
}

const VALID_SUBSCRIPTION = { id: "sub-1" };
const NO_MEMBERSHIP_FEE_REQUIRED = { required_for_access: false };

test("allows access when certificate, block and subscription are all fine", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer(),
    today: TODAY,
    activeBlock: null,
    membershipSetting: NO_MEMBERSHIP_FEE_REQUIRED,
    validMembershipFee: null,
    validSubscription: VALID_SUBSCRIPTION,
  });

  assert.deepEqual(result, { allowed: true, reason: "Accesso consentito" });
});

test("denies access when customer has no branch", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer({ branch_id: null }),
    today: TODAY,
    activeBlock: null,
    membershipSetting: NO_MEMBERSHIP_FEE_REQUIRED,
    validMembershipFee: null,
    validSubscription: VALID_SUBSCRIPTION,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "Cliente non associato a nessuna sede");
});

test("denies access when an active block exists, and surfaces its reason", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer(),
    today: TODAY,
    activeBlock: { reason: "Comportamento scorretto" },
    membershipSetting: NO_MEMBERSHIP_FEE_REQUIRED,
    validMembershipFee: null,
    validSubscription: VALID_SUBSCRIPTION,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "Accesso bloccato: Comportamento scorretto");
});

test("denies access when medical certificate is missing entirely", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer({
      medical_certificate_start_date: null,
      medical_certificate_end_date: null,
    }),
    today: TODAY,
    activeBlock: null,
    membershipSetting: NO_MEMBERSHIP_FEE_REQUIRED,
    validMembershipFee: null,
    validSubscription: VALID_SUBSCRIPTION,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "Certificato medico scaduto o mancante");
});

test("denies access when medical certificate has expired", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer({
      medical_certificate_start_date: "2025-01-01",
      medical_certificate_end_date: "2026-01-01",
    }),
    today: TODAY,
    activeBlock: null,
    membershipSetting: NO_MEMBERSHIP_FEE_REQUIRED,
    validMembershipFee: null,
    validSubscription: VALID_SUBSCRIPTION,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "Certificato medico scaduto o mancante");
});

test("denies access when medical certificate has not started yet", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer({
      medical_certificate_start_date: "2099-01-01",
      medical_certificate_end_date: "2100-01-01",
    }),
    today: TODAY,
    activeBlock: null,
    membershipSetting: NO_MEMBERSHIP_FEE_REQUIRED,
    validMembershipFee: null,
    validSubscription: VALID_SUBSCRIPTION,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "Certificato medico scaduto o mancante");
});

test("denies access when status is explicitly 'expired' even inside the date window", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer({ medical_certificate_status: "EXPIRED" }),
    today: TODAY,
    activeBlock: null,
    membershipSetting: NO_MEMBERSHIP_FEE_REQUIRED,
    validMembershipFee: null,
    validSubscription: VALID_SUBSCRIPTION,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "Certificato medico scaduto o mancante");
});

test("denies access when the branch requires a membership fee and none is valid", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer(),
    today: TODAY,
    activeBlock: null,
    membershipSetting: { required_for_access: true },
    validMembershipFee: null,
    validSubscription: VALID_SUBSCRIPTION,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "Quota associativa assente o scaduta");
});

test("allows access when the branch requires a membership fee and a valid one exists", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer(),
    today: TODAY,
    activeBlock: null,
    membershipSetting: { required_for_access: true },
    validMembershipFee: { id: "fee-1" },
    validSubscription: VALID_SUBSCRIPTION,
  });

  assert.equal(result.allowed, true);
});

test("ignores membership fee status when the branch does not require it", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer(),
    today: TODAY,
    activeBlock: null,
    membershipSetting: { required_for_access: false },
    validMembershipFee: null,
    validSubscription: VALID_SUBSCRIPTION,
  });

  assert.equal(result.allowed, true);
});

test("denies access when there is no valid subscription", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer(),
    today: TODAY,
    activeBlock: null,
    membershipSetting: NO_MEMBERSHIP_FEE_REQUIRED,
    validMembershipFee: null,
    validSubscription: null,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "Abbonamento assente o scaduto");
});

test("checks block before medical certificate (block takes priority)", () => {
  const result = evaluateAccessEligibility({
    customer: baseCustomer({ medical_certificate_start_date: null }),
    today: TODAY,
    activeBlock: { reason: "Sospeso" },
    membershipSetting: NO_MEMBERSHIP_FEE_REQUIRED,
    validMembershipFee: null,
    validSubscription: VALID_SUBSCRIPTION,
  });

  assert.equal(result.reason, "Accesso bloccato: Sospeso");
});
