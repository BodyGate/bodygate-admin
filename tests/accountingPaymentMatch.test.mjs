import assert from "node:assert/strict";
import test from "node:test";

import { findMatchingAccountingPayment } from "../app/lib/server/accountingPaymentMatch.ts";

const existing = {
  id: "cp-2",
  amount: 50,
  description: "Quota corso",
  paid_at: "2026-10-02T09:00:00Z",
};

test("prefers the exact id over an earlier description match", () => {
  const rows = [
    { id: "p-1", amount: 30, description: "Quota corso", paid_at: "2026-09-01T09:00:00Z" },
    { id: "cp-2", amount: 50, description: "Quota corso", paid_at: "2026-10-02T09:00:00Z" },
  ];
  assert.equal(findMatchingAccountingPayment(rows, existing)?.id, "cp-2");
});

test("does not rewrite an unrelated payment that only shares the description", () => {
  const rows = [
    { id: "p-1", amount: 30, description: "Quota corso", paid_at: "2026-09-01T09:00:00Z" },
    { id: "p-2", amount: 40, description: "Quota corso", paid_at: "2026-09-15T09:00:00Z" },
  ];
  assert.equal(findMatchingAccountingPayment(rows, existing), null);
});

test("uses same day and amount before description", () => {
  const rows = [
    { id: "p-1", amount: 30, description: "Quota corso", paid_at: "2026-09-01T09:00:00Z" },
    { id: "p-2", amount: 50, description: "altro", paid_at: "2026-10-02T18:00:00Z" },
  ];
  assert.equal(findMatchingAccountingPayment(rows, existing)?.id, "p-2");
});

test("falls back to a unique description match", () => {
  const rows = [
    { id: "p-1", amount: 30, description: "Quota corso", paid_at: "2026-09-01T09:00:00Z" },
  ];
  assert.equal(findMatchingAccountingPayment(rows, existing)?.id, "p-1");
});

test("empty description never matches by description", () => {
  const rows = [{ id: "p-1", amount: 1, description: "", paid_at: "2026-01-01" }];
  assert.equal(
    findMatchingAccountingPayment(rows, { ...existing, description: "" }),
    null,
  );
});

test("two payments with same day and amount are ambiguous: no match", () => {
  const rows = [
    { id: "p-1", amount: 50, description: "Quota corso", paid_at: "2026-10-02T08:00:00Z" },
    { id: "p-2", amount: 50, description: "Quota corso", paid_at: "2026-10-02T18:00:00Z" },
  ];
  assert.equal(findMatchingAccountingPayment(rows, existing), null);
});

// update-subscription/route.ts matches a subscription's unlinked accounting
// row the same way, but has no specific payment id or paid_at to go on
// (it's reconciling by old amount + description only, already pre-filtered
// by amount): existing.id is "" and paid_at is omitted.
const subscriptionLookup = {
  id: "",
  amount: 50,
  description: "Rinnovo abbonamento Mensile (2026-01-01 - 2026-01-31)",
};

test("subscription lookup (no id, no paid_at): unique description match is used", () => {
  const rows = [
    { id: "p-1", amount: 50, description: "Rinnovo abbonamento Mensile (2026-01-01 - 2026-01-31)" },
  ];
  assert.equal(findMatchingAccountingPayment(rows, subscriptionLookup)?.id, "p-1");
});

test("subscription lookup (no id, no paid_at): two unrelated renewals with the same amount+description are left untouched", () => {
  const rows = [
    { id: "p-1", amount: 50, description: "Rinnovo abbonamento Mensile (2026-01-01 - 2026-01-31)" },
    { id: "p-2", amount: 50, description: "Rinnovo abbonamento Mensile (2026-01-01 - 2026-01-31)" },
  ];
  assert.equal(findMatchingAccountingPayment(rows, subscriptionLookup), null);
});
