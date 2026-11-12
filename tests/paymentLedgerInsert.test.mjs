import assert from "node:assert/strict";
import test from "node:test";

import { insertPaymentLedgerPair } from "../app/lib/server/paymentLedgerInsert.ts";

function makeDb({ paymentsInsertError, customerPaymentsInsertError } = {}) {
  const calls = { deletedPaymentIds: [] };

  const db = {
    from(table) {
      if (table === "payments") {
        return {
          insert() {
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve(
                      paymentsInsertError
                        ? { data: null, error: { message: paymentsInsertError } }
                        : { data: { id: "payment-1" }, error: null },
                    );
                  },
                };
              },
            };
          },
          delete() {
            return {
              eq(_column, value) {
                calls.deletedPaymentIds.push(value);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      if (table === "customer_payments") {
        return {
          insert() {
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve(
                      customerPaymentsInsertError
                        ? { data: null, error: { message: customerPaymentsInsertError } }
                        : { data: { id: "customer-payment-1" }, error: null },
                    );
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };

  return { db, calls };
}

test("returns both ids when the accounting row and the customer row are created", async () => {
  const { db, calls } = makeDb();
  const result = await insertPaymentLedgerPair(db, { amount: 10 }, { amount: 10 });

  assert.deepEqual(result, {
    ok: true,
    paymentId: "payment-1",
    customerPaymentId: "customer-payment-1",
  });
  assert.deepEqual(calls.deletedPaymentIds, []);
});

test("does not touch customer_payments when the accounting insert fails", async () => {
  const { db, calls } = makeDb({ paymentsInsertError: "boom" });
  const result = await insertPaymentLedgerPair(db, { amount: 10 }, { amount: 10 });

  assert.deepEqual(result, { ok: false, error: "boom" });
  assert.deepEqual(calls.deletedPaymentIds, []);
});

test("rolls back the orphaned accounting row when the customer insert fails", async () => {
  const { db, calls } = makeDb({ customerPaymentsInsertError: "constraint violation" });
  const result = await insertPaymentLedgerPair(db, { amount: 10 }, { amount: 10 });

  assert.deepEqual(result, { ok: false, error: "constraint violation" });
  assert.deepEqual(calls.deletedPaymentIds, ["payment-1"]);
});
