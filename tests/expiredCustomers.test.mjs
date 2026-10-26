import assert from "node:assert/strict";
import test from "node:test";

import {
  runExpiredCustomersCheck,
  selectCustomersToExpire,
} from "../app/lib/server/expiredCustomers.ts";

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

test("several current rows for the same customer do not change the outcome", () => {
  const result = selectCustomersToExpire(
    [{ id: "a" }, { id: "b" }, { id: "c" }],
    [{ customer_id: "a" }, { customer_id: "a" }, { customer_id: "c" }]
  );
  assert.deepEqual(result, [{ id: "b" }]);
});

test("candidate order and extra fields are preserved", () => {
  const candidates = [
    { id: "z", subscription_expiry: "2026-01-01" },
    { id: "y", subscription_expiry: "2026-02-01" },
  ];
  assert.deepEqual(selectCustomersToExpire(candidates, []), candidates);
});

// --- orchestrazione con un database finto in memoria -------------------------

class FakeQuery {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.updateValues = null;
    this.orderColumn = null;
    this.rangeBounds = null;
  }
  select() { return this; }
  update(values) { this.updateValues = values; return this; }
  lt(c, v) { this.filters.push((r) => r[c] != null && r[c] < v); return this; }
  lte(c, v) { this.filters.push((r) => r[c] != null && r[c] <= v); return this; }
  gte(c, v) { this.filters.push((r) => r[c] != null && r[c] >= v); return this; }
  neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  in(c, values) { this.filters.push((r) => values.includes(r[c])); return this; }
  order(c) { this.orderColumn = c; return this; }
  range(from, to) { this.rangeBounds = [from, to]; return this; }
  then(resolve, reject) {
    try {
      this.db.reads += 1;
      let rows = this.db.tables[this.table].filter((r) => this.filters.every((f) => f(r)));
      if (this.updateValues) {
        rows.forEach((r) => Object.assign(r, this.updateValues));
        this.db.updates += rows.length;
      }
      if (this.orderColumn) rows = [...rows].sort((a, b) => String(a[this.orderColumn]).localeCompare(String(b[this.orderColumn])));
      if (this.rangeBounds) rows = rows.slice(this.rangeBounds[0], this.rangeBounds[1] + 1);
      const error = this.db.failOn === this.table ? { message: "boom " + this.table } : null;
      resolve({ data: error ? null : rows.map((r) => ({ ...r })), error });
    } catch (e) { reject(e); }
  }
}

function fakeDb({ customers, subscriptions, failOn = null }) {
  const db = { tables: { customers, customer_subscriptions: subscriptions }, reads: 0, updates: 0, failOn };
  db.from = (table) => new FakeQuery(db, table);
  return db;
}

const NOW = "2026-10-26T12:00:00.000Z";
const TODAY = "2026-10-26";

function customer(id, expiry = "2026-06-01T00:00:00+00:00", status = "active") {
  return { id, subscription_expiry: expiry, subscription_status: status, active: true };
}
function sub(id, customerId, from = "2026-10-01", to = "2026-11-30", isActive = true) {
  return { id, customer_id: customerId, starts_at: from, ends_at: to, is_active: isActive };
}

test("expires only who has no current subscription; renewed customers are kept", async () => {
  const db = fakeDb({
    customers: [customer("a"), customer("b"), customer("c"), customer("d", "2027-01-01T00:00:00+00:00")],
    subscriptions: [sub("s1", "a"), sub("s2", "b", "2025-01-01", "2025-12-31"), sub("s3", "c", "2026-10-01", "2026-11-30", false)],
  });
  const out = await runExpiredCustomersCheck(db, { nowIso: NOW, todayIso: TODAY, dryRun: false });

  assert.deepEqual(out.candidates.map((c) => c.id), ["a", "b", "c"]);
  assert.deepEqual(out.toExpire.map((c) => c.id), ["b", "c"]);
  assert.deepEqual(out.expired.map((c) => c.id), ["b", "c"]);
  assert.equal(db.tables.customers.find((c) => c.id === "a").active, true);
  assert.equal(db.tables.customers.find((c) => c.id === "b").active, false);
  assert.equal(db.tables.customers.find((c) => c.id === "b").subscription_status, "expired");
  assert.equal(db.tables.customers.find((c) => c.id === "d").active, true);
});

test("dry run reports the same customers but writes nothing", async () => {
  const db = fakeDb({ customers: [customer("a"), customer("b")], subscriptions: [sub("s1", "a")] });
  const out = await runExpiredCustomersCheck(db, { nowIso: NOW, todayIso: TODAY, dryRun: true });

  assert.deepEqual(out.toExpire.map((c) => c.id), ["b"]);
  assert.deepEqual(out.expired, []);
  assert.equal(db.updates, 0);
  assert.equal(db.tables.customers.every((c) => c.active === true), true);
});

test("already expired customers are not candidates", async () => {
  const db = fakeDb({ customers: [customer("a", undefined, "expired")], subscriptions: [] });
  const out = await runExpiredCustomersCheck(db, { nowIso: NOW, todayIso: TODAY, dryRun: false });
  assert.deepEqual(out.candidates, []);
});

test("paging: more candidates than a page, and a customer with more current rows than a page", async () => {
  const customers = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"].map((id) => customer(id));
  // c7 has 5 overlapping current rows (more than pageSize=2): must still be kept
  const subscriptions = [
    ...["x1", "x2", "x3", "x4", "x5"].map((id) => sub(id, "c7")),
    sub("y1", "c2"),
  ];
  const db = fakeDb({ customers, subscriptions });
  const out = await runExpiredCustomersCheck(db, { nowIso: NOW, todayIso: TODAY, dryRun: false, pageSize: 2, chunkSize: 3 });

  assert.equal(out.candidates.length, 7);
  assert.deepEqual(out.toExpire.map((c) => c.id), ["c1", "c3", "c4", "c5", "c6"]);
  assert.equal(db.tables.customers.find((c) => c.id === "c7").active, true);
  assert.equal(db.tables.customers.find((c) => c.id === "c2").active, true);
});

test("a database error aborts before any update", async () => {
  const db = fakeDb({ customers: [customer("a")], subscriptions: [], failOn: "customer_subscriptions" });
  await assert.rejects(
    runExpiredCustomersCheck(db, { nowIso: NOW, todayIso: TODAY, dryRun: false }),
    /boom customer_subscriptions/
  );
  assert.equal(db.updates, 0);
  assert.equal(db.tables.customers[0].active, true);
});
