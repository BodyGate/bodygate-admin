import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import bcrypt from "bcryptjs";
import {
  BASELINE_FILES,
  SEED_SQL,
  describePlan,
  generatePassword,
  generateSecret,
  parseArgs,
  validateOptions,
} from "../scripts/tenant/lib.mjs";

const base = { name: "Palestra Rossi", adminEmail: "titolare@example.com", databaseUrl: "postgresql://x/y" };

test("validateOptions accepts a complete request", () => {
  assert.deepEqual(validateOptions(base), []);
});

test("validateOptions rejects missing name, bad email, short password, bad url", () => {
  const errors = validateOptions({ name: "", adminEmail: "no", adminPassword: "corta", databaseUrl: "mysql://x" });
  assert.equal(errors.length, 4);
});

test("dry run does not need a database url", () => {
  assert.deepEqual(validateOptions({ ...base, databaseUrl: undefined, dryRun: true }), []);
});

test("parseArgs reads flags and rejects unknown ones", () => {
  const o = parseArgs(["--name", "A B", "--admin-email", "a@b.it", "--dry-run"]);
  assert.equal(o.name, "A B");
  assert.equal(o.dryRun, true);
  assert.throws(() => parseArgs(["--boom"]), /sconosciuto/);
});

test("generated password is long, unambiguous and different each time", () => {
  const a = generatePassword();
  assert.equal(a.length, 20);
  assert.match(a, /^[abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  assert.notEqual(a, generatePassword());
});

test("generated secrets are 64 hex chars and unique", () => {
  assert.match(generateSecret(), /^[0-9a-f]{64}$/);
  assert.notEqual(generateSecret(), generateSecret());
});

test("seed SQL never concatenates user input (uses psql variables only)", () => {
  for (const v of ["branch_name", "admin_email", "admin_hash", "admin_name"]) {
    assert.ok(SEED_SQL.includes(`:'${v}'`), `manca :'${v}'`);
  }
  assert.ok(!/\$\{/.test(SEED_SQL));
});

test("plan lists every baseline file in order", () => {
  const plan = describePlan(base).join("\n");
  let last = -1;
  for (const f of BASELINE_FILES) {
    const at = plan.indexOf(f);
    assert.ok(at > last, `${f} fuori ordine`);
    last = at;
  }
});

// Integrazione: richiede un PostgreSQL VUOTO e psql. Salta se non configurato.
const dbUrl = process.env.TENANT_TEST_DATABASE_URL;
const hasPsql = spawnSync("psql", ["--version"]).status === 0;

test("provisioning end to end on an empty database", { skip: !(dbUrl && hasPsql) }, () => {
  const run = (extra = []) =>
    spawnSync(
      process.execPath,
      ["scripts/tenant/provision-tenant.mjs", "--name", "Palestra Test; drop table x", "--admin-email", "Owner@Example.com", "--admin-password", "una-password-lunga-123", ...extra],
      { env: { ...process.env, TENANT_DATABASE_URL: dbUrl }, encoding: "utf8" },
    );
  const q = (sql) => spawnSync("psql", [dbUrl, "-At", "-c", sql], { encoding: "utf8" }).stdout.trim();

  // Guasto a meta': una tabella con lo stesso nome di una vista della baseline
  // fa fallire il file 04, DOPO che 01-03 hanno gia' creato lo schema.
  q("create table public.bodygate_v2_customers (id int)");
  const broken = run();
  assert.notEqual(broken.status, 0, "il provisioning deve fallire con l'ostacolo");
  assert.equal(q("select to_regclass('public.customers') is null"), "t", "rollback: nessuna tabella deve restare");
  assert.equal(q("select to_regclass('public.app_users') is null"), "t");
  q("drop table public.bodygate_v2_customers");

  const first = run(); // il database e' ancora vuoto: si puo' riprovare
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /PALESTRA CREATA/);

  assert.equal(q("select count(*) from public.branches"), "1");
  assert.equal(q("select name from public.branches"), "Palestra Test; drop table x");
  assert.equal(q("select email from public.app_users"), "owner@example.com");
  assert.equal(q("select count(*) from public.staff_users"), "1");
  assert.equal(q("select count(*) from public.membership_fee_settings"), "1");
  assert.notEqual(q("select password from public.app_users"), "una-password-lunga-123");
  assert.ok(bcrypt.compareSync("una-password-lunga-123", q("select password from public.app_users")));

  const second = run();
  assert.notEqual(second.status, 0, "il secondo lancio deve rifiutare un database non vuoto");
  assert.match(second.stderr, /rifiuto di procedere/);
  assert.equal(q("select count(*) from public.app_users"), "1");
});
