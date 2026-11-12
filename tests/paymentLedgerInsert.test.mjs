import assert from "node:assert/strict";
import test from "node:test";

import { insertPaymentLedgerPair } from "../app/lib/server/paymentLedgerInsert.ts";

const baseArgs = {
  customerId: "customer-1",
  paymentMethodId: "method-1",
  amount: 10,
  paymentType: "other",
  description: null,
  paymentMethodName: "cash",
  createdBy: "admin@bodygate.it",
};

function makeDb(outcome) {
  const calls = [];
  const db = {
    rpc(fn, args) {
      calls.push({ fn, args });
      return Promise.resolve(outcome);
    },
  };
  return { db, calls };
}

test("returns both ids when the RPC reports both rows", async () => {
  const { db, calls } = makeDb({
    data: {
      payment: { id: "payment-1" },
      customer_payment: { id: "customer-payment-1" },
    },
    error: null,
  });

  const result = await insertPaymentLedgerPair(db, baseArgs);

  assert.deepEqual(result, {
    ok: true,
    paymentId: "payment-1",
    customerPaymentId: "customer-payment-1",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fn, "create_misc_payment_atomic_v1");
  assert.equal(calls[0].args.p_customer_id, "customer-1");
  assert.equal(calls[0].args.p_amount, 10);
});

test("reports the error when the RPC fails", async () => {
  const { db } = makeDb({
    data: null,
    error: { message: "BODYGATE_VALIDATION_AMOUNT" },
  });

  const result = await insertPaymentLedgerPair(db, baseArgs);

  assert.deepEqual(result, { ok: false, error: "BODYGATE_VALIDATION_AMOUNT" });
});

test("reports a generic error when the RPC returns neither row nor error", () => {
  return (async () => {
    const { db } = makeDb({ data: null, error: null });
    const result = await insertPaymentLedgerPair(db, baseArgs);
    assert.deepEqual(result, { ok: false, error: "Errore creazione pagamento." });
  })();
});
