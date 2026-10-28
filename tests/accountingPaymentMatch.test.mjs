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
