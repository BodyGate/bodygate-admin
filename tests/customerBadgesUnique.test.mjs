import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// customer_badges has no unique constraint on badge_code in the baseline
// schema (supabase/baseline/02_constraints_indexes.sql), but
// update-profile/route.ts upserts into it with { onConflict: "badge_code" }.
// Without a matching unique constraint Postgres rejects that ON CONFLICT
// target (42P10) on every call, and the route didn't check the error, so it
// reported success while customer_badges silently kept no record of the
// badge. These checks guard the fix: the migration that adds the missing
// constraint, and the route actually checking both upsert errors instead of
// swallowing them.

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIRECTORY = path.join(TEST_DIRECTORY, "..");
const MIGRATIONS_DIRECTORY = path.join(ROOT_DIRECTORY, "supabase", "migrations");
const ROUTE_FILE = path.join(
  ROOT_DIRECTORY,
  "app",
  "api",
  "customers",
  "update-profile",
  "route.ts",
);

function readMigrations() {
  return readdirSync(MIGRATIONS_DIRECTORY)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(path.join(MIGRATIONS_DIRECTORY, name), "utf8"));
}

test("a migration adds a unique constraint on customer_badges.badge_code", () => {
  const migrations = readMigrations();

  const hasConstraint = migrations.some(
    (sql) =>
      /alter\s+table\s+public\.customer_badges/i.test(sql) &&
      /add\s+constraint\s+\S+\s+unique\s*\(\s*badge_code\s*\)/i.test(sql),
  );

  assert.ok(
    hasConstraint,
    "expected a migration to add `unique (badge_code)` on public.customer_badges, " +
      "so the onConflict: \"badge_code\" upsert in update-profile/route.ts has a " +
      "matching constraint to target",
  );
});

test("update-profile checks the error from both badge upserts instead of swallowing it", () => {
  const source = readFileSync(ROUTE_FILE, "utf8");

  // route.ts also *selects* from access_credentials earlier (inside
  // findBadgeConflict), so anchor on the upsert call itself, not just the
  // table name, to avoid matching that unrelated read.
  const accessCredentialsUpsert = source.indexOf(
    '.from("access_credentials")\n        .upsert(',
  );
  const customerBadgesUpsert = source.indexOf(
    '.from("customer_badges")\n        .upsert(',
  );

  assert.ok(accessCredentialsUpsert !== -1, "access_credentials upsert not found");
  assert.ok(customerBadgesUpsert !== -1, "customer_badges upsert not found");

  // The destructured error must appear on the same `await ... .upsert(` call,
  // not just somewhere later in the file, so a regression that goes back to
  // a bare `await supabaseAdmin.from(...).upsert(...)` (ignoring the result)
  // is caught instead of matching an unrelated error check elsewhere.
  const beforeAccessCredentials = source.slice(0, accessCredentialsUpsert);
  const beforeCustomerBadges = source.slice(0, customerBadgesUpsert);

  assert.match(
    beforeAccessCredentials.slice(beforeAccessCredentials.lastIndexOf("\n\n")),
    /const\s*\{\s*error:\s*accessCredentialError\s*\}\s*=\s*await\s+supabaseAdmin/,
    "access_credentials upsert must capture and check its error",
  );

  assert.match(
    beforeCustomerBadges.slice(beforeCustomerBadges.lastIndexOf("\n\n")),
    /const\s*\{\s*error:\s*customerBadgeError\s*\}\s*=\s*await\s+supabaseAdmin/,
    "customer_badges upsert must capture and check its error",
  );

  assert.match(source, /if\s*\(\s*accessCredentialError\s*\)/);
  assert.match(source, /if\s*\(\s*customerBadgeError\s*\)/);
});
