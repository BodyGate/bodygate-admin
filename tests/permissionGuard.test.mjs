import assert from "node:assert/strict";
import test from "node:test";

import { canAccess } from "../app/lib/auth/permissions.ts";

const subject = (permissions, isAdmin = false) => ({ isAdmin, permissions });

test("admin passes regardless of the permissions list", () => {
  assert.equal(canAccess(subject([], true), ["manage_staff"]), true);
});

test("non-admin needs every required permission", () => {
  assert.equal(canAccess(subject(["manage_staff"]), ["manage_staff"]), true);
  assert.equal(
    canAccess(subject(["manage_staff"]), ["manage_staff", "manage_payments"]),
    false,
  );
});

test("missing permission is denied", () => {
  assert.equal(canAccess(subject(["view_customers"]), ["manage_staff"]), false);
});

test("user without staff profile (no permissions) is denied", () => {
  assert.equal(canAccess(subject([]), ["manage_staff"]), false);
});

test("no permission required only needs a valid session", () => {
  assert.equal(canAccess(subject([]), []), true);
});

test("permission matching is exact, not by prefix", () => {
  assert.equal(canAccess(subject(["manage_staff_extra"]), ["manage_staff"]), false);
});
