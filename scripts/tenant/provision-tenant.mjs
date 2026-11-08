#!/usr/bin/env node
// Crea una nuova palestra (tenant) su un database PostgreSQL/Supabase VUOTO.
//
//   TENANT_DATABASE_URL=postgresql://... node scripts/tenant/provision-tenant.mjs \
//     --name "Centro Rossi" --admin-email titolare@example.com [--branch-name "Sede Centro" --branch-name "Sede Nord"] [--plans-file listini.json] [--admin-name "Mario Rossi"]
//
// Non crea il progetto Supabase (serve un database vuoto gia' esistente) e non
// tocca mai un database che contiene gia' la tabella public.customers.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import {
  BASELINE_FILES,
  buildPlansSql,
  buildSeedSql,
  describePlan,
  generatePassword,
  generateSecret,
  parseArgs,
  resolveBranches,
  validateOptions,
  validatePlans,
} from "./lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const baselineDir = join(root, "supabase", "baseline");

function psql(url, args, input) {
  const result = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", ...args], {
    input,
    encoding: "utf8",
    env: { ...process.env, PGOPTIONS: "-c search_path=public,extensions" },
  });
  if (result.error) throw new Error(`psql non disponibile: ${result.error.message}`);
  if (result.status !== 0) throw new Error((result.stderr || "").trim() || "psql ha fallito");
  return (result.stdout || "").trim();
}

function fail(message) {
  console.error(`\nERRORE: ${message}`);
  process.exit(1);
}

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (error) {
  fail(error.message);
}

const errors = validateOptions(opts);
if (errors.length) fail(errors.join("\n"));

let plansData = null;
if (opts.plansFile) {
  try {
    plansData = JSON.parse(readFileSync(opts.plansFile, "utf8"));
  } catch (error) {
    fail(`--plans-file: impossibile leggere o interpretare il file (${error.message}).`);
  }
  const planErrors = validatePlans(plansData, resolveBranches(opts));
  if (planErrors.length) fail(planErrors.join("\n"));
}

if (opts.dryRun) {
  console.log("DRY RUN: nessuna modifica. Piano:\n");
  console.log(describePlan(opts).map((line) => `  ${line}`).join("\n"));
  process.exit(0);
}

const branches = resolveBranches(opts);
const generated = !opts.adminPassword;
const adminPassword = opts.adminPassword || generatePassword();
const adminName = opts.adminName || opts.name;

try {
  console.log("1/4 Verifica che il database sia vuoto...");
  const existing = psql(opts.databaseUrl, ["-At", "-c", "select to_regclass('public.customers') is not null"]);
  if (existing === "t") {
    fail("il database contiene gia' public.customers: rifiuto di procedere. Usare un database vuoto.");
  }

  console.log("2/4 Preparo l'amministratore...");
  const hash = await bcrypt.hash(adminPassword, 12);

  console.log("3/4 Applico baseline e dati iniziali in UNA transazione (o tutto o niente)...");
  const fileArgs = BASELINE_FILES.flatMap((file) => ["-f", join(baselineDir, file)]);
  psql(
    opts.databaseUrl,
    [
      "-1",
      ...branches.flatMap((name, i) => ["-v", `branch_name_${i + 1}=${name}`]),
      "-v", `admin_email=${opts.adminEmail.trim()}`,
      "-v", `admin_name=${adminName.trim()}`,
      "-v", `admin_hash=${hash}`,
      ...(plansData ? ["-v", `plans_json=${JSON.stringify(plansData)}`] : []),
      ...fileArgs,
      "-f", "-",
    ],
    buildSeedSql(branches.length) + (plansData ? buildPlansSql() : ""),
  );

  console.log("4/4 Verifica finale...");
  const check = psql(opts.databaseUrl, ["-At", "-F", ",", "-c", `
    select
      (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'),
      (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity),
      (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated')),
      (select count(*) from public.branches),
      (select count(*) from public.app_users),
      (select count(*) from public.subscription_plans)`]);
  const branchCount = branches.length;
  const [tables, rls, publicGrants, createdBranches, admins, createdPlans] = check.split(",").map(Number);
  const expectedPlans = plansData?.plans?.length ?? 0;
  if (tables !== 67 || rls !== 67 || publicGrants !== 0 || createdBranches !== branchCount || admins !== 1 || createdPlans !== expectedPlans) {
    fail(`verifica finale non superata (tabelle=${tables}, rls=${rls}, privilegi pubblici=${publicGrants}, sedi=${createdBranches}/${branchCount}, admin=${admins}, piani=${createdPlans}/${expectedPlans}).`);
  }
} catch (error) {
  fail(error.message);
}

console.log(`
CENTRO CREATO: ${opts.name}
Sedi (${branches.length}): ${branches.join(", ")}${plansData ? `\nListini caricati: ${plansData.plans?.length ?? 0} piani` : ""}

Accesso amministratore
  email:    ${opts.adminEmail}
  password: ${generated ? adminPassword : "(quella fornita)"}${generated ? "\n  (generata ora: mostrata una sola volta, conservarla in un gestore di password;\n   l'app non ha ancora una funzione di cambio o recupero password)" : ""}

Variabili d'ambiente da impostare sul deploy di questa palestra
  NEXT_PUBLIC_SUPABASE_URL=<URL del progetto Supabase>
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<chiave anon del progetto>
  SUPABASE_SERVICE_ROLE_KEY=<chiave service role del progetto>
  BODYGATE_SESSION_SECRET=${generateSecret()}
  BODYGATE_MACHINE_KEY=${generateSecret()}
  BODYGATE_MACHINE_AUTH_MODE=enforce

I segreti sopra sono nuovi e univoci per questa palestra: non riusare quelli di
un'altra sede. Non salvarli in chiaro nel repository.
`);
