import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAccessEligibility } from "../app/lib/server/accessEligibility.ts";
import { feeKey, isAccessReady as check } from "../app/lib/server/accessReadyCount.ts";

const isAccessReady = (c, x) => check(evaluateAccessEligibility, c, x);

const TODAY = "2026-10-28";

function customer(overrides = {}) {
  return {
    id: "c1",
    is_active: true,
    branch_id: "b1",
    medical_certificate_start_date: "2026-01-01",
    medical_certificate_end_date: "2027-01-01",
    medical_certificate_status: "valid",
    ...overrides,
  };
}

function ctx(overrides = {}) {
  return {
    today: TODAY,
    feeKeys: new Set([feeKey("c1", "b1")]),
    subscriptionCustomerIds: new Set(["c1"]),
    blockedCustomerIds: new Set(),
    ...overrides,
  };
}

test("tutti e tre i requisiti validi: accesso attivo", () => {
  assert.equal(isAccessReady(customer(), ctx()), true);
});

test("manca la quota associativa: non attivo", () => {
  assert.equal(isAccessReady(customer(), ctx({ feeKeys: new Set() })), false);
});

test("la quota di un'altra sede non vale", () => {
  assert.equal(
    isAccessReady(customer(), ctx({ feeKeys: new Set([feeKey("c1", "b2")]) })),
    false
  );
});

test("manca l'abbonamento: non attivo", () => {
  assert.equal(
    isAccessReady(customer(), ctx({ subscriptionCustomerIds: new Set() })),
    false
  );
});

test("certificato scaduto, mancante o con stato expired: non attivo", () => {
  assert.equal(isAccessReady(customer({ medical_certificate_end_date: "2026-10-27" }), ctx()), false);
  assert.equal(isAccessReady(customer({ medical_certificate_end_date: null }), ctx()), false);
  assert.equal(isAccessReady(customer({ medical_certificate_status: "expired" }), ctx()), false);
});

test("il certificato vale fino al giorno di scadenza incluso", () => {
  assert.equal(isAccessReady(customer({ medical_certificate_end_date: TODAY }), ctx()), true);
});

test("blocco attivo o cliente senza sede: non attivo", () => {
  assert.equal(isAccessReady(customer(), ctx({ blockedCustomerIds: new Set(["c1"]) })), false);
  assert.equal(isAccessReady(customer({ branch_id: null }), ctx()), false);
});
