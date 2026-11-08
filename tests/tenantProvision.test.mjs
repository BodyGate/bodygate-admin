import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import bcrypt from "bcryptjs";
import {
  BASELINE_FILES,
  MAX_BRANCHES,
  buildPlansSql,
  buildSeedSql,
  describePlan,
  generatePassword,
  generateSecret,
  parseArgs,
  resolveBranches,
  validateOptions,
  validatePlans,
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
  const sql = buildSeedSql(2);
  for (const v of ["branch_name_1", "branch_name_2", "branch_1_id", "branch_2_id", "admin_email", "admin_hash", "admin_name"]) {
    assert.ok(sql.includes(`:'${v}'`), `manca :'${v}'`);
  }
  assert.ok(!/\$\{/.test(sql));
  assert.ok(!/\bbegin\b|\bcommit\b/i.test(sql), "la transazione la apre psql -1");
});

test("seed SQL creates one branch and one fee setting per branch", () => {
  const sql = buildSeedSql(3);
  assert.equal((sql.match(/insert into public\.branches/g) || []).length, 3);
  assert.equal((sql.match(/insert into public\.membership_fee_settings/g) || []).length, 3);
  assert.equal((sql.match(/insert into public\.app_users/g) || []).length, 1);
});

test("a centre can have several branches; default is one branch named like the centre", () => {
  assert.deepEqual(resolveBranches({ name: "Centro Rossi" }), ["Centro Rossi"]);
  const o = parseArgs(["--name", "Centro Rossi", "--branch-name", "Sede Centro", "--branch-name", "Sede Nord"]);
  assert.deepEqual(resolveBranches(o), ["Sede Centro", "Sede Nord"]);
});

test("branch validation: unique names, minimum length, upper bound", () => {
  const ok = { ...base, dryRun: true };
  assert.deepEqual(validateOptions({ ...ok, branchNames: ["Sede A", "Sede B"] }), []);
  assert.equal(validateOptions({ ...ok, branchNames: ["Sede A", "sede a"] }).length, 1);
  assert.equal(validateOptions({ ...ok, branchNames: ["A"] }).length, 1);
  const many = Array.from({ length: MAX_BRANCHES + 1 }, (_, i) => `Sede ${i + 1}`);
  assert.equal(validateOptions({ ...ok, branchNames: many }).length, 1);
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

const SEDI = ["Sede Centro", "Sede Nord"];
const goodPlans = {
  membership_fees: [{ branch: "Sede Centro", price: 15, validity_days: 365 }],
  plans: [
    { branch: "Sede Centro", category: "Abbonamenti", name: "Mensile", price: 49.9, duration_days: 30, sort_order: 1 },
    { branch: "Sede Nord", category: "Abbonamenti", name: "Mensile", price: 39, duration_days: 30, description: "Promo apertura", promo_price: 29 },
  ],
};

test("listini: un file corretto e' valido; sede, prezzo, durata e duplicati vengono controllati", () => {
  assert.deepEqual(validatePlans(goodPlans, SEDI), []);
  assert.ok(validatePlans({ plans: [{ ...goodPlans.plans[0], branch: "Altrove" }] }, SEDI).some((e) => /non fra quelle/.test(e)));
  assert.ok(validatePlans({ plans: [{ ...goodPlans.plans[0], price: -1 }] }, SEDI).some((e) => /prezzo/.test(e)));
  assert.ok(validatePlans({ plans: [{ ...goodPlans.plans[0], duration_days: 0 }] }, SEDI).some((e) => /duration_days/.test(e)));
  assert.ok(validatePlans({ plans: [goodPlans.plans[0], goodPlans.plans[0]] }, SEDI).some((e) => /duplicato/.test(e)));
  assert.ok(validatePlans([], SEDI).length > 0);
  assert.ok(validatePlans({ membership_fees: [{ branch: "Sede Centro", price: 1 }, { branch: "sede centro", price: 2 }] }, SEDI).some((e) => /ripetuta/.test(e)));
});

test("listini: stessa voce in due sedi e' consentita (prezzi per sede)", () => {
  const two = { plans: [goodPlans.plans[0], { ...goodPlans.plans[0], branch: "Sede Nord", price: 59 }] };
  assert.deepEqual(validatePlans(two, SEDI), []);
});

test("listini: l'SQL usa una sola variabile psql e nessuna concatenazione", () => {
  const sql = buildPlansSql();
  assert.ok(sql.includes(":'plans_json'"));
  assert.ok(!/\$\{/.test(sql));
  assert.ok(!/^\s*(begin|commit)\s*;/im.test(sql), "la transazione la apre psql -1");
});

// Integrazione: richiede un PostgreSQL VUOTO e psql. Salta se non configurato.
const dbUrl = process.env.TENANT_TEST_DATABASE_URL;
const hasPsql = spawnSync("psql", ["--version"]).status === 0;

test("provisioning end to end on an empty database", { skip: !(dbUrl && hasPsql) }, () => {
  const plansPath = join(mkdtempSync(join(tmpdir(), "bg-plans-")), "listini.json");
  writeFileSync(plansPath, JSON.stringify({
    membership_fees: [{ branch: "Sede Uno; drop table x", price: 15, validity_days: 180 }],
    plans: [
      { branch: "Sede Uno; drop table x", category: "Abbonamenti", name: "Mensile", price: 49.9, duration_days: 30, sort_order: 1 },
      { branch: "Sede Due", category: "Abbonamenti", name: "Mensile", price: 39, duration_days: 30, promo_price: 29, description: "O'Brien's promo" },
      { branch: "Sede Due", category: "Corsi", name: "10 ingressi", price: 80, duration_days: 90 },
    ],
  }));
  const run = (extra = []) =>
    spawnSync(
      process.execPath,
      ["scripts/tenant/provision-tenant.mjs", "--name", "Centro Test", "--branch-name", "Sede Uno; drop table x", "--branch-name", "Sede Due", "--admin-email", "Owner@Example.com", "--admin-password", "una-password-lunga-123", "--plans-file", plansPath, ...extra],
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
  assert.match(first.stdout, /CENTRO CREATO/);

  assert.equal(q("select count(*) from public.branches"), "2");
  assert.equal(q("select string_agg(name, '|' order by name) from public.branches"), "Sede Due|Sede Uno; drop table x");
  assert.equal(q("select email from public.app_users"), "owner@example.com");
  assert.equal(q("select count(*) from public.staff_users"), "1");
  assert.equal(q("select count(*) from public.membership_fee_settings"), "2");
  assert.equal(q("select count(distinct branch_id) from public.membership_fee_settings"), "2");

  // Listini per sede: stessa voce in due sedi con prezzi diversi, categorie per sede.
  assert.equal(q("select count(*) from public.subscription_plans"), "3");
  assert.equal(q("select count(*) from public.subscription_categories"), "3");
  assert.equal(q("select count(distinct (branch_id, name)) from public.subscription_categories"), "3");
  assert.equal(q("select p.price::text from public.subscription_plans p join public.branches b on b.id = p.branch_id where b.name = 'Sede Due' and p.name = 'Mensile'"), "39.00");
  assert.equal(q("select p.price::text from public.subscription_plans p join public.branches b on b.id = p.branch_id where b.name like 'Sede Uno%' and p.name = 'Mensile'"), "49.90");
  assert.equal(q("select description from public.subscription_plans where promo_price = 29"), "O'Brien's promo");
  assert.equal(q("select count(*) from public.subscription_plans p join public.subscription_categories c on c.id = p.category_id and c.branch_id = p.branch_id"), "3");
  assert.equal(q("select price::text || '/' || validity_days from public.membership_fee_settings f join public.branches b on b.id = f.branch_id where b.name like 'Sede Uno%'"), "15.00/180");
  assert.equal(q("select price::text || '/' || validity_days from public.membership_fee_settings f join public.branches b on b.id = f.branch_id where b.name = 'Sede Due'"), "10.00/365");
  assert.notEqual(q("select password from public.app_users"), "una-password-lunga-123");
  assert.ok(bcrypt.compareSync("una-password-lunga-123", q("select password from public.app_users")));

  const second = run();
  assert.notEqual(second.status, 0, "il secondo lancio deve rifiutare un database non vuoto");
  assert.match(second.stderr, /rifiuto di procedere/);
  assert.equal(q("select count(*) from public.app_users"), "1");
});
