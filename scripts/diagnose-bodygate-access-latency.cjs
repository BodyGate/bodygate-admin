const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { createClient } = require("@supabase/supabase-js");

const ROOT = "C:\\bodygate-admin";
const ENV_FILE = path.join(ROOT, ".env.local");
const badge = String(process.argv[2] || "325666").trim();
const iterations = Math.max(1, Number(process.argv[3] || 3));

function loadEnv(file) {
  const env = {};
  const text = fs.readFileSync(file, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq < 1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

async function timed(label, fn) {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;

  if (result && result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return { label, ms, result };
}

function fmt(ms) {
  return `${ms.toFixed(1)} ms`;
}

async function findBadge(supabase) {
  let result = await supabase
    .from("access_credentials")
    .select("id, customer_id, code, controller_code, status, type")
    .eq("status", "active")
    .or(`code.eq.${badge},controller_code.eq.${badge}`)
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  if (result.data?.customer_id) {
    return {
      source: "access_credentials",
      customerId: result.data.customer_id,
      badgeCode: result.data.code || badge,
      controllerCode: result.data.controller_code || badge,
    };
  }

  result = await supabase
    .from("customer_badges")
    .select("id, customer_id, badge_code, is_active")
    .eq("is_active", true)
    .eq("badge_code", badge)
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  if (result.data?.customer_id) {
    return {
      source: "customer_badges",
      customerId: result.data.customer_id,
      badgeCode: result.data.badge_code || badge,
      controllerCode: badge,
    };
  }

  result = await supabase
    .from("customers")
    .select("id, badge_code, controller_code")
    .or(`badge_code.eq.${badge},controller_code.eq.${badge}`)
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  if (result.data?.id) {
    return {
      source: "customers",
      customerId: result.data.id,
      badgeCode: result.data.badge_code || badge,
      controllerCode: result.data.controller_code || badge,
    };
  }

  return null;
}

async function main() {
  console.log("");
  console.log("=== BODYGATE ACCESS LATENCY - READ ONLY ===");
  console.log(`Badge test: ${badge}`);
  console.log(`Iterazioni: ${iterations}`);
  console.log("Nessuna INSERT/UPDATE/DELETE verrà eseguita.");
  console.log("");

  if (!fs.existsSync(ENV_FILE)) {
    throw new Error(`File non trovato: ${ENV_FILE}`);
  }

  const env = loadEnv(ENV_FILE);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Configurazione Supabase mancante in .env.local");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  for (let run = 1; run <= iterations; run++) {
    console.log(`--- RUN ${run}/${iterations} ---`);

    const totalStart = performance.now();

    const badgeStep = await timed("badge_lookup", () => findBadge(supabase));
    const match = badgeStep.result;

    if (!match) {
      console.log(`badge_lookup          ${fmt(badgeStep.ms)}`);
      console.log("RISULTATO: badge non trovato. Interrompo.");
      return;
    }

    const customerStep = await timed("customer", () =>
      supabase
        .from("customers")
        .select("*")
        .eq("id", match.customerId)
        .limit(1)
        .maybeSingle()
    );

    const customer = customerStep.result.data;
    if (!customer) throw new Error("Cliente non trovato.");

    const customerId = customer.id;
    const branchId = customer.branch_id;
    const today = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    if (!branchId) throw new Error("Cliente senza branch_id.");

    const blockStep = await timed("customer_blocks", () =>
      supabase
        .from("customer_blocks")
        .select("*")
        .eq("customer_id", customerId)
        .eq("is_active", true)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .limit(1)
        .maybeSingle()
    );

    const membershipSettingStep = await timed("membership_settings", () =>
      supabase
        .from("membership_fee_settings")
        .select("*")
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
    );

    let membershipFeeStep = null;
    if (membershipSettingStep.result.data?.required_for_access) {
      membershipFeeStep = await timed("membership_fee", () =>
        supabase
          .from("customer_membership_fees")
          .select("*")
          .eq("customer_id", customerId)
          .eq("branch_id", branchId)
          .lte("valid_from", today)
          .gte("valid_until", today)
          .order("valid_until", { ascending: false })
          .limit(1)
          .maybeSingle()
      );
    }

    const subscriptionStep = await timed("subscription", () =>
      supabase
        .from("customer_subscriptions")
        .select("id, customer_id, starts_at, ends_at, is_active")
        .eq("customer_id", customerId)
        .eq("is_active", true)
        .lte("starts_at", today)
        .gte("ends_at", today)
        .order("ends_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    );

    const sequentialTotal = performance.now() - totalStart;

    const parallelStart = performance.now();

    const parallelQueries = [
      supabase
        .from("customer_blocks")
        .select("*")
        .eq("customer_id", customerId)
        .eq("is_active", true)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("membership_fee_settings")
        .select("*")
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("customer_subscriptions")
        .select("id, customer_id, starts_at, ends_at, is_active")
        .eq("customer_id", customerId)
        .eq("is_active", true)
        .lte("starts_at", today)
        .gte("ends_at", today)
        .order("ends_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ];

    if (membershipSettingStep.result.data?.required_for_access) {
      parallelQueries.push(
        supabase
          .from("customer_membership_fees")
          .select("*")
          .eq("customer_id", customerId)
          .eq("branch_id", branchId)
          .lte("valid_from", today)
          .gte("valid_until", today)
          .order("valid_until", { ascending: false })
          .limit(1)
          .maybeSingle()
      );
    }

    const parallelResults = await Promise.all(parallelQueries);
    for (const r of parallelResults) {
      if (r.error) throw r.error;
    }

    const parallelPolicyMs = performance.now() - parallelStart;

    console.log(`badge_lookup          ${fmt(badgeStep.ms)}`);
    console.log(`customer              ${fmt(customerStep.ms)}`);
    console.log(`customer_blocks       ${fmt(blockStep.ms)}`);
    console.log(`membership_settings   ${fmt(membershipSettingStep.ms)}`);
    if (membershipFeeStep) {
      console.log(`membership_fee        ${fmt(membershipFeeStep.ms)}`);
    } else {
      console.log("membership_fee        SKIP (non richiesta)");
    }
    console.log(`subscription          ${fmt(subscriptionStep.ms)}`);
    console.log(`READ SEQUENZIALI      ${fmt(sequentialTotal)}`);
    console.log(`POLICY IN PARALLELO   ${fmt(parallelPolicyMs)}`);
    console.log(`Fonte badge: ${match.source}`);
    console.log(`Cliente: ${customer.first_name || ""} ${customer.last_name || ""}`.trim());
    console.log("");
  }

  console.log("=== FINE TEST READ ONLY ===");
}

main().catch((error) => {
  console.error("");
  console.error("ERRORE TEST:", error?.message || error);
  process.exitCode = 1;
});
