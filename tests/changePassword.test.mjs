import assert from "node:assert/strict";
import test from "node:test";

import bcrypt from "bcryptjs";
import { validateNewPassword } from "../app/lib/auth/passwordPolicy.ts";
import { changePassword } from "../app/lib/server/changePassword.ts";

function setup({ stored = bcrypt.hashSync("password-attuale-123", 4), auditFails = false, setFails = false, noUser = false } = {}) {
  const calls = { set: [], audit: [] };
  const store = {
    getHash: async () => (noUser ? null : stored),
    setHash: async (id, hash) => { if (setFails) throw new Error("db"); calls.set.push({ id, hash }); },
    audit: async (e) => { if (auditFails) throw new Error("audit"); calls.audit.push(e); },
  };
  const crypto = { compare: (p, h) => bcrypt.compare(p, h), hash: (p) => bcrypt.hash(p, 4) };
  return { calls, deps: { store, crypto, validate: validateNewPassword } };
}
const input = (extra = {}) => ({ userId: "u1", email: "titolare@example.com", current: "password-attuale-123", next: "Nuova-password-sicura-9", ...extra });

test("changes the password, stores a bcrypt hash (never the plain text) and audits", async () => {
  const { calls, deps } = setup();
  const r = await changePassword(deps, input());
  assert.deepEqual(r, { ok: true });
  assert.equal(calls.set.length, 1);
  assert.notEqual(calls.set[0].hash, "Nuova-password-sicura-9");
  assert.ok(bcrypt.compareSync("Nuova-password-sicura-9", calls.set[0].hash));
  assert.deepEqual(calls.audit, [{ userId: "u1", email: "titolare@example.com" }]);
});

test("wrong current password: 400 and nothing is written", async () => {
  const { calls, deps } = setup();
  const r = await changePassword(deps, input({ current: "sbagliata-sbagliata" }));
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.match(r.error, /attuale non/);
  assert.equal(calls.set.length, 0);
  assert.equal(calls.audit.length, 0);
});

test("weak new password: 400 before touching the store", async () => {
  const { calls, deps } = setup();
  const r = await changePassword(deps, input({ next: "corta" }));
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(calls.set.length, 0);
});

test("missing fields: 400", async () => {
  const { deps } = setup();
  assert.equal((await changePassword(deps, input({ current: "" }))).status, 400);
  assert.equal((await changePassword(deps, input({ next: "" }))).status, 400);
});

test("unknown or inactive user: 500, nothing written", async () => {
  const { calls, deps } = setup({ noUser: true });
  const r = await changePassword(deps, input());
  assert.equal(r.ok, false);
  assert.equal(r.status, 500);
  assert.equal(calls.set.length, 0);
});

test("an audit failure does not undo a successful change", async () => {
  const { calls, deps } = setup({ auditFails: true });
  const r = await changePassword(deps, input());
  assert.deepEqual(r, { ok: true });
  assert.equal(calls.set.length, 1);
});

test("a write failure is reported to the caller (route turns it into a generic 500)", async () => {
  const { deps } = setup({ setFails: true });
  await assert.rejects(() => changePassword(deps, input()), /db/);
});
