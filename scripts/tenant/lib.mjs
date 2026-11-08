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

export function describePlan(opts) {
  const branches = resolveBranches(opts);
  return [
    `Centro: ${opts.name}`,
    `Sedi (${branches.length}): ${branches.join(", ")}`,
    `Amministratore: ${opts.adminEmail}`,
    "1. Verifica che il database sia vuoto (nessuna tabella public.customers)",
    `2. Applica la baseline in una sola transazione: ${BASELINE_FILES.join(", ")}`,
    "3. Crea le sedi, le impostazioni quota associativa di ciascuna, l'utente amministratore e il profilo staff (stessa transazione: o tutto o niente)",
    "4. Verifica finale (66 tabelle, RLS attiva, nessun privilegio pubblico)",
    "5. Stampa i segreti da inserire nelle variabili d'ambiente",
  ];
}
