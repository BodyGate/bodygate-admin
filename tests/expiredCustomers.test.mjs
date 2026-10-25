import assert from "node:assert/strict";
import test from "node:test";

import { selectCustomersToExpire } from "../app/lib/server/expiredCustomers.ts";

test("customer with a stale subscription_expiry but a current subscription is not expired", () => {
  const result = selectCustomersToExpire(
    [{ id: "renewed" }, { id: "lapsed" }],
    [{ customer_id: "renewed" }]
  );
  assert.deepEqual(result, [{ id: "lapsed" }]);
});

test("no current subscriptions: every candidate is expired", () => {
  const candidates = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(selectCustomersToExpire(candidates, []), candidates);
});

test("no candidates: nothing to expire", () => {
  assert.deepEqual(selectCustomersToExpire([], [{ customer_id: "x" }]), []);
});
