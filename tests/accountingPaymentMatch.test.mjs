import test from "node:test";
import assert from "node:assert/strict";
import { findMatchingAccountingPayment as find } from "../app/lib/server/accountingPaymentMatch.ts";

const existing = { id: "cp-2", amount: 50, description: "Abbonamento Mensile", paid_at: "2026-10-05T10:00:00Z" };

test("prefers same date+amount over an older payment with the same description", () => {
  const old = { id: "p-1", amount: 50, description: "Abbonamento Mensile", paid_at: "2026-09-05T10:00:00Z" };
  const current = { id: "p-2", amount: "50.00", description: null, paid_at: "2026-10-05T09:00:00Z" };
  assert.equal(find([old, current], existing), current);
});

test("does not guess when several payments match on description only", () => {
  const a = { id: "p-1", amount: 40, description: "Abbonamento Mensile", paid_at: "2026-08-05" };
  const b = { id: "p-2", amount: 45, description: "Abbonamento Mensile", paid_at: "2026-09-05" };
  assert.equal(find([a, b], existing), undefined);
});

test("falls back to a unique description match", () => {
  const a = { id: "p-1", amount: 50, description: "Abbonamento Mensile", paid_at: "2026-10-06" };
  assert.equal(find([a], existing), a);
});

test("ambiguous date+amount yields no match", () => {
  const a = { id: "p-1", amount: 50, paid_at: "2026-10-05" };
  const b = { id: "p-2", amount: 50, paid_at: "2026-10-05" };
  assert.equal(find([a, b], existing), undefined);
});
