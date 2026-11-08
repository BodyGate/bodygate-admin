// Funzioni pure per il provisioning di una nuova palestra (testate in
// tests/tenantProvision.test.mjs). Nessun accesso a rete o database qui.
import { randomBytes } from "node:crypto";

export const BASELINE_FILES = [
  "01_extensions_types_tables.sql",
  "02_constraints_indexes.sql",
  "03_functions.sql",
  "04_triggers_views_security.sql",
  "05_reference_seed.sql",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseArgs(argv) {
  const opts = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--database-url") opts.databaseUrl = argv[++i];
    else if (arg === "--name") opts.name = argv[++i];
    else if (arg === "--branch-name") (opts.branchNames ||= []).push(argv[++i]);
    else if (arg === "--admin-email") opts.adminEmail = argv[++i];
    else if (arg === "--admin-name") opts.adminName = argv[++i];
    else if (arg === "--plans-file") opts.plansFile = argv[++i];
    else if (arg === "--admin-password") opts.adminPassword = argv[++i];
    else throw new Error(`Argomento sconosciuto: ${arg}`);
  }
  // L'URL del database si puo' passare anche da variabile d'ambiente, per non
  // lasciarlo nella cronologia della shell.
  opts.databaseUrl = opts.databaseUrl || process.env.TENANT_DATABASE_URL;
  opts.adminPassword = opts.adminPassword || process.env.TENANT_ADMIN_PASSWORD;
  return opts;
}

export const MAX_BRANCHES = 20;

// Un centro (--name) puo' avere piu' sedi (--branch-name, ripetibile). Senza
// --branch-name si crea una sola sede con lo stesso nome del centro.
export function resolveBranches(opts) {
  const names = (opts.branchNames?.length ? opts.branchNames : [opts.name])
    .filter((n) => typeof n === "string")
    .map((n) => n.trim());
  return names;
}

export function validateOptions(opts) {
  const errors = [];
  if (!opts.name || opts.name.trim().length < 2) {
    errors.push("--name: nome del centro obbligatorio (almeno 2 caratteri).");
  }
  if (!opts.adminEmail || !EMAIL_RE.test(opts.adminEmail)) {
    errors.push("--admin-email: email dell'amministratore non valida.");
  }
  // Senza --branch-name la sede ha il nome del centro, gia' controllato sopra.
  if (opts.branchNames?.length) {
    const branches = resolveBranches(opts);
    if (branches.some((n) => n.length < 2)) {
      errors.push("--branch-name: ogni sede deve avere un nome di almeno 2 caratteri.");
    }
    if (branches.length > MAX_BRANCHES) {
      errors.push(`--branch-name: al massimo ${MAX_BRANCHES} sedi per centro.`);
    }
    if (new Set(branches.map((n) => n.toLowerCase())).size !== branches.length) {
      errors.push("--branch-name: i nomi delle sedi devono essere diversi tra loro.");
    }
  }
  if (opts.adminPassword !== undefined && opts.adminPassword.length < 12) {
    errors.push("--admin-password: almeno 12 caratteri.");
  }
  if (!opts.dryRun) {
    if (!opts.databaseUrl) {
      errors.push("--database-url (o TENANT_DATABASE_URL): URL del database vuoto.");
    } else if (!/^postgres(ql)?:\/\//.test(opts.databaseUrl)) {
      errors.push("--database-url: deve iniziare con postgresql://");
    }
  }
  return errors;
}

export function generatePassword(length = 20) {
  // Alfabeto senza caratteri ambigui (0/O, 1/l/I).
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function generateSecret(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

// Script psql: i valori arrivano come variabili (-v) e sono quotati da psql
// con :'nome', quindi nessuna concatenazione di stringhe nell'SQL.
// Eseguito nella stessa transazione della baseline (psql -1): se qualcosa
// fallisce, non resta nulla e il database vuoto e' di nuovo riutilizzabile.
export function buildSeedSql(branchCount = 1) {
  const branches = Array.from({ length: branchCount }, (_, i) => {
    const n = i + 1;
    return `insert into public.branches (name) values (:'branch_name_${n}') returning id \\gset branch_${n}_
insert into public.membership_fee_settings (branch_id) values (:'branch_${n}_id');
`;
  }).join("\n");

  return `
${branches}
insert into public.app_users (email, password, role, active)
values (lower(:'admin_email'), :'admin_hash', 'admin', true);

insert into public.staff_users (full_name, email, role_id, is_active)
select :'admin_name', lower(:'admin_email'), id, true
from public.staff_roles where role_key = 'admin';
`;
}

// --- Listini per sede (file JSON opzionale: --plans-file) ---------------------
//
// {
//   "membership_fees": [ { "branch": "Sede Centro", "price": 15, "validity_days": 365 } ],
//   "plans": [
//     { "branch": "Sede Centro", "category": "Abbonamenti", "name": "Mensile",
//       "price": 49.9, "duration_days": 30, "description": "...", "promo_price": null, "sort_order": 1 }
//   ]
// }
export const MAX_PLANS = 500;

export function validatePlans(data, branchNames) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["--plans-file: il file deve contenere un oggetto con 'plans' e/o 'membership_fees'."];
  }
  const known = new Set(branchNames.map((n) => n.toLowerCase()));
  const branchOk = (b) => typeof b === "string" && known.has(b.trim().toLowerCase());
  const isMoney = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 100000;

  const plans = data.plans ?? [];
  const fees = data.membership_fees ?? [];
  if (!Array.isArray(plans) || !Array.isArray(fees)) {
    return ["--plans-file: 'plans' e 'membership_fees' devono essere elenchi."];
  }
  if (plans.length > MAX_PLANS) errors.push(`--plans-file: al massimo ${MAX_PLANS} piani.`);

  const seen = new Set();
  plans.forEach((p, i) => {
    const at = `piano #${i + 1}`;
    if (!p || typeof p !== "object") { errors.push(`${at}: non e' un oggetto.`); return; }
    if (!branchOk(p.branch)) errors.push(`${at}: sede '${p.branch}' non fra quelle create (${branchNames.join(", ")}).`);
    if (typeof p.category !== "string" || p.category.trim().length < 2) errors.push(`${at}: categoria obbligatoria.`);
    if (typeof p.name !== "string" || p.name.trim().length < 2) errors.push(`${at}: nome obbligatorio.`);
    if (!isMoney(p.price)) errors.push(`${at}: prezzo non valido.`);
    if (p.promo_price != null && !isMoney(p.promo_price)) errors.push(`${at}: prezzo promo non valido.`);
    if (!Number.isInteger(p.duration_days) || p.duration_days < 1 || p.duration_days > 3650) {
      errors.push(`${at}: duration_days deve essere un intero tra 1 e 3650.`);
    }
    if (p.sort_order != null && !Number.isInteger(p.sort_order)) errors.push(`${at}: sort_order deve essere intero.`);
    const key = [p.branch, p.category, p.name].map((x) => String(x).trim().toLowerCase()).join("|");
    if (seen.has(key)) errors.push(`${at}: duplicato (${p.branch} / ${p.category} / ${p.name}).`);
    seen.add(key);
  });

  const feeBranches = new Set();
  fees.forEach((f, i) => {
    const at = `quota #${i + 1}`;
    if (!f || typeof f !== "object") { errors.push(`${at}: non e' un oggetto.`); return; }
    if (!branchOk(f.branch)) errors.push(`${at}: sede '${f.branch}' non fra quelle create.`);
    if (!isMoney(f.price)) errors.push(`${at}: prezzo non valido.`);
    if (f.validity_days != null && (!Number.isInteger(f.validity_days) || f.validity_days < 1 || f.validity_days > 3650)) {
      errors.push(`${at}: validity_days deve essere un intero tra 1 e 3650.`);
    }
    const k = String(f.branch).trim().toLowerCase();
    if (feeBranches.has(k)) errors.push(`${at}: sede ripetuta.`);
    feeBranches.add(k);
  });
  return errors;
}

// L'intero file arriva come UNA variabile psql (:'plans_json'): nessuna
// concatenazione di valori nell'SQL. Si appende dopo buildSeedSql().
export function buildPlansSql() {
  return `
create temp table _plans_src on commit drop as
select b.id as branch_id,
       trim(p->>'category') as category,
       trim(p->>'name') as name,
       (p->>'price')::numeric as price,
       (p->>'duration_days')::int as duration_days,
       nullif(trim(p->>'description'), '') as description,
       nullif(p->>'promo_price', '')::numeric as promo_price,
       coalesce((p->>'sort_order')::int, 0) as sort_order
from jsonb_array_elements(coalesce(:'plans_json'::jsonb -> 'plans', '[]'::jsonb)) p
join public.branches b on lower(b.name) = lower(trim(p->>'branch'));

insert into public.subscription_categories (branch_id, name, sort_order)
select branch_id, category, min(sort_order) from _plans_src group by branch_id, category;

insert into public.subscription_plans
  (branch_id, category_id, category, name, price, promo_price, duration_days, description, sort_order, access_allowed, is_active)
select s.branch_id, c.id, s.category, s.name, s.price, s.promo_price, s.duration_days, s.description, s.sort_order, true, true
from _plans_src s
join public.subscription_categories c on c.branch_id = s.branch_id and c.name = s.category;

update public.membership_fee_settings f
set price = (m->>'price')::numeric,
    validity_days = coalesce((m->>'validity_days')::int, f.validity_days)
from jsonb_array_elements(coalesce(:'plans_json'::jsonb -> 'membership_fees', '[]'::jsonb)) m,
     public.branches b
where lower(b.name) = lower(trim(m->>'branch')) and f.branch_id = b.id;
`;
}

export function describePlan(opts) {
  const branches = resolveBranches(opts);
  return [
    `Centro: ${opts.name}`,
    `Sedi (${branches.length}): ${branches.join(", ")}`,
    `Amministratore: ${opts.adminEmail}`,
    "1. Verifica che il database sia vuoto (nessuna tabella public.customers)",
    `2. Applica la baseline in una sola transazione: ${BASELINE_FILES.join(", ")}`,
    "3. Crea le sedi, le impostazioni quota associativa di ciascuna, l'utente amministratore e il profilo staff (stessa transazione: o tutto o niente)",
    ...(opts.plansFile ? [`3b. Carica listini e quote associative per sede da ${opts.plansFile}`] : []),
    "4. Verifica finale (66 tabelle, RLS attiva, nessun privilegio pubblico)",
    "5. Stampa i segreti da inserire nelle variabili d'ambiente",
  ];
}
