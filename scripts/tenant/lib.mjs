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

export function validateOptions(opts) {
  const errors = [];
  if (!opts.name || opts.name.trim().length < 2) {
    errors.push("--name: nome della palestra obbligatorio (almeno 2 caratteri).");
  }
  if (!opts.adminEmail || !EMAIL_RE.test(opts.adminEmail)) {
    errors.push("--admin-email: email dell'amministratore non valida.");
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
export const SEED_SQL = `
\\set ON_ERROR_STOP on
begin;

insert into public.branches (name) values (:'branch_name') returning id \\gset branch_

insert into public.membership_fee_settings (branch_id) values (:'branch_id');

insert into public.app_users (email, password, role, active)
values (lower(:'admin_email'), :'admin_hash', 'admin', true);

insert into public.staff_users (full_name, email, role_id, is_active)
select :'admin_name', lower(:'admin_email'), id, true
from public.staff_roles where role_key = 'admin';

commit;
`;

export function describePlan(opts) {
  return [
    `Palestra: ${opts.name}`,
    `Amministratore: ${opts.adminEmail}`,
    "1. Verifica che il database sia vuoto (nessuna tabella public.customers)",
    `2. Applica la baseline: ${BASELINE_FILES.join(", ")}`,
    "3. Crea sede, impostazioni quota associativa, utente amministratore e profilo staff",
    "4. Verifica finale (66 tabelle, RLS attiva, nessun privilegio pubblico)",
    "5. Stampa i segreti da inserire nelle variabili d'ambiente",
  ];
}
