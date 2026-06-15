import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { rfidLookupCodes } from "../../../utils/rfid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Supabase = ReturnType<typeof getSupabaseClient>;
type OwnerType = "customer" | "staff" | "none" | "conflict";

type DebugMatch = {
  source: "access_credentials" | "customer_badges" | "staff_access_credentials" | "customers.badge_code" | "customers.controller_code";
  field: string;
  id: string | null;
  owner_type: "customer" | "staff";
  owner_id: string | null;
  code: string;
  active: boolean | null;
  status: string | null;
};

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeCode(value: unknown) {
  return String(value || "").trim();
}

function isActiveCredential(row: any) {
  if (typeof row?.is_active === "boolean") return row.is_active;
  return String(row?.status || "").toLowerCase() === "active";
}

function dateOnly(value: unknown) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function nameOf(person: any) {
  return String(
    person?.full_name || `${person?.first_name || ""} ${person?.last_name || ""}`
  ).trim() || null;
}

async function safeSelect<T>(label: string, query: PromiseLike<{ data: T | null; error: any }>, warnings: string[]) {
  const { data, error } = await query;
  if (error) warnings.push(`${label}: ${error.message}`);
  return error ? null : data;
}

async function findMatches(supabase: Supabase, code: string, warnings: string[]) {
  const matches: DebugMatch[] = [];
  const lookupCodes = rfidLookupCodes(code);
  const credentialFilter = lookupCodes.map((item) => `code.eq.${item},controller_code.eq.${item}`).join(",");
  const badgeFilter = lookupCodes.map((item) => `badge_code.eq.${item}`).join(",");
  const customerFilter = lookupCodes.map((item) => `badge_code.eq.${item},controller_code.eq.${item}`).join(",");

  const accessCredentials = await safeSelect<any[]>(
    "Lettura access_credentials",
    supabase
      .from("access_credentials")
      .select("id, customer_id, code, controller_code, type, status")
      .or(credentialFilter),
    warnings
  );

  for (const row of accessCredentials || []) {
    matches.push({
      source: "access_credentials",
      field: lookupCodes.includes(row.code) ? "code" : "controller_code",
      id: row.id ?? null,
      owner_type: "customer",
      owner_id: row.customer_id ?? null,
      code,
      active: isActiveCredential(row),
      status: row.status ?? null,
    });
  }

  const customerBadges = await safeSelect<any[]>(
    "Lettura customer_badges",
    supabase
      .from("customer_badges")
      .select("id, customer_id, badge_code, is_active")
      .or(badgeFilter),
    warnings
  );

  for (const row of customerBadges || []) {
    matches.push({
      source: "customer_badges",
      field: "badge_code",
      id: row.id ?? null,
      owner_type: "customer",
      owner_id: row.customer_id ?? null,
      code,
      active: typeof row.is_active === "boolean" ? row.is_active : null,
      status: typeof row.is_active === "boolean" ? (row.is_active ? "active" : "inactive") : null,
    });
  }

  const staffCredentials = await safeSelect<any[]>(
    "Lettura staff_access_credentials",
    supabase
      .from("staff_access_credentials")
      .select("id, staff_user_id, code, controller_code, type, status")
      .or(credentialFilter),
    warnings
  );

  for (const row of staffCredentials || []) {
    matches.push({
      source: "staff_access_credentials",
      field: lookupCodes.includes(row.code) ? "code" : "controller_code",
      id: row.id ?? null,
      owner_type: "staff",
      owner_id: row.staff_user_id ?? null,
      code,
      active: isActiveCredential(row),
      status: row.status ?? null,
    });
  }

  const customers = await safeSelect<any[]>(
    "Lettura customers badge/controller",
    supabase
      .from("customers")
      .select("id, badge_code, controller_code")
      .or(customerFilter),
    warnings
  );

  for (const row of customers || []) {
    if (lookupCodes.includes(row.badge_code)) {
      matches.push({ source: "customers.badge_code", field: "badge_code", id: row.id ?? null, owner_type: "customer", owner_id: row.id ?? null, code, active: null, status: "legacy" });
    }
    if (lookupCodes.includes(row.controller_code)) {
      matches.push({ source: "customers.controller_code", field: "controller_code", id: row.id ?? null, owner_type: "customer", owner_id: row.id ?? null, code, active: null, status: "legacy" });
    }
  }

  return matches;
}

function resolveOwnerType(matches: DebugMatch[]): OwnerType {
  const customerIds = new Set(matches.filter((m) => m.owner_type === "customer" && m.owner_id).map((m) => m.owner_id));
  const staffIds = new Set(matches.filter((m) => m.owner_type === "staff" && m.owner_id).map((m) => m.owner_id));
  if (!customerIds.size && !staffIds.size) return "none";
  if (customerIds.size + staffIds.size > 1 || (customerIds.size && staffIds.size)) return "conflict";
  return staffIds.size ? "staff" : "customer";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = normalizeCode(body.code || body.badge || body.badge_code);
    const warnings: string[] = [];

    if (!code) {
      return NextResponse.json({ input: { code }, matches: [], owner_type: "none", checks: {}, warnings: ["Codice mancante"], final_allowed: false, final_reason: "Codice badge/QR mancante" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const today = new Date().toISOString().slice(0, 10);
    const matches = await findMatches(supabase, code, warnings);
    const ownerType = resolveOwnerType(matches);
    const activeMatches = matches.filter((m) => m.active !== false);

    const response: any = {
      input: { code, checked_at: new Date().toISOString() },
      matches,
      owner_type: ownerType,
      customer: null,
      staff: null,
      checks: {
        credential: {
          status: matches.length ? (activeMatches.length ? "valid_or_legacy" : "inactive") : "missing",
          active_matches: activeMatches.length,
          inactive_matches: matches.length - activeMatches.length,
        },
      },
      warnings,
      final_allowed: false,
      final_reason: "Badge non riconosciuto",
      simulation_only: true,
    };

    if (matches.length > 1) response.warnings.push("Codice trovato in più record o fonti: verificare duplicati/sovrapposizioni.");
    if (ownerType === "conflict") {
      response.final_reason = "Conflitto: codice associato a più proprietari cliente/staff";
      return NextResponse.json(response);
    }
    if (ownerType === "none") return NextResponse.json(response);

    if (!activeMatches.length) {
      response.final_reason = "Credenziale trovata ma inattiva";
      return NextResponse.json(response);
    }

    if (ownerType === "staff") {
      const staffId = activeMatches.find((m) => m.owner_type === "staff")?.owner_id;
      const staff = await safeSelect<any>("Lettura staff_users", supabase.from("staff_users").select("id, full_name, email, phone, is_active, role_id, staff_roles(role_key, role_name)").eq("id", staffId).limit(1).maybeSingle(), warnings);
      response.staff = staff ? { id: staff.id, name: nameOf(staff), email: staff.email ?? null, phone: staff.phone ?? null, is_active: staff.is_active !== false, role: (staff.staff_roles as any)?.role_name ?? null } : null;
      response.checks.staff = { status: staff?.is_active === false ? "inactive" : staff ? "active" : "missing" };
      response.final_allowed = Boolean(staff && staff.is_active !== false);
      response.final_reason = response.final_allowed ? "Accesso staff autorizzato (simulato, tornello non aperto)" : "Staff mancante o non attivo";
      return NextResponse.json(response);
    }

    const customerId = activeMatches.find((m) => m.owner_type === "customer")?.owner_id;
    const customer = await safeSelect<any>("Lettura customers", supabase.from("customers").select("*").eq("id", customerId).limit(1).maybeSingle(), warnings);
    response.customer = customer ? { id: customer.id, name: nameOf(customer), email: customer.email ?? null, phone: customer.phone ?? null, branch_id: customer.branch_id ?? null, is_active: customer.is_active !== false, badge_code: customer.badge_code ?? null, controller_code: customer.controller_code ?? null } : null;
    response.checks.customer = { status: customer?.is_active === false ? "inactive" : customer ? "active" : "missing" };

    if (!customer || customer.is_active === false) {
      response.final_reason = "Cliente mancante o non attivo";
      return NextResponse.json(response);
    }

    const branchId = customer.branch_id;
    const blocks = await safeSelect<any[]>("Lettura customer_blocks", supabase.from("customer_blocks").select("*").eq("customer_id", customer.id).eq("is_active", true).or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`), warnings);
    response.checks.blocks = { status: blocks?.length ? "active_blocks" : "clear", items: blocks || [] };

    const certStart = dateOnly(customer.medical_certificate_start_date || customer.medical_certificate_start);
    const certEnd = dateOnly(customer.medical_certificate_end_date || customer.medical_certificate_end);
    const certStatus = String(customer.medical_certificate_status || "").toLowerCase();
    const certRows = await safeSelect<any[]>("Lettura medical_certificates", supabase.from("medical_certificates").select("*").eq("customer_id", customer.id).order("expiry_date", { ascending: false }).limit(5), warnings);
    const validCertRow = (certRows || []).find((c) => String(c.status || "approved").toLowerCase() !== "expired" && (dateOnly(c.valid_until) || dateOnly(c.expiry_date) || "0000-00-00") >= today);
    const certValid = Boolean((certStart && certEnd && certStart <= today && certEnd >= today && certStatus !== "expired") || validCertRow);
    response.checks.medical_certificate = { status: certValid ? "valid" : certRows?.length || certStart || certEnd ? "expired_or_incoherent" : "missing", customer_fields: { valid_from: certStart, valid_until: certEnd, status: certStatus || null }, latest_records: certRows || [] };

    const setting = branchId ? await safeSelect<any>("Lettura membership_fee_settings", supabase.from("membership_fee_settings").select("*").eq("branch_id", branchId).eq("is_active", true).limit(1).maybeSingle(), warnings) : null;
    let membershipFee: any = null;
    if (setting?.required_for_access) {
      membershipFee = await safeSelect<any>("Lettura customer_membership_fees", supabase.from("customer_membership_fees").select("*").eq("customer_id", customer.id).eq("branch_id", branchId).lte("valid_from", today).gte("valid_until", today).order("valid_until", { ascending: false }).limit(1).maybeSingle(), warnings);
    }
    response.checks.membership_fee = { required: Boolean(setting?.required_for_access), status: !setting?.required_for_access ? "not_required" : membershipFee ? "valid" : "missing_or_expired", item: membershipFee };

    const subscription = await safeSelect<any>("Lettura customer_subscriptions", supabase.from("customer_subscriptions").select("id, customer_id, starts_at, ends_at, is_active").eq("customer_id", customer.id).eq("is_active", true).lte("starts_at", today).gte("ends_at", today).order("ends_at", { ascending: false }).limit(1).maybeSingle(), warnings);
    response.checks.subscription = { status: subscription ? "valid" : "missing_or_expired", item: subscription };

    const denial = blocks?.length ? `Accesso bloccato: ${blocks[0].reason || "blocco cliente attivo"}` : !certValid ? "Certificato medico scaduto, mancante o incoerente" : setting?.required_for_access && !membershipFee ? "Quota associativa assente o scaduta" : !subscription ? "Abbonamento assente o scaduto" : null;
    response.final_allowed = !denial;
    response.final_reason = denial || "Accesso cliente consentito (simulato, tornello non aperto)";

    return NextResponse.json(response);
  } catch (error: unknown) {
    return NextResponse.json({ final_allowed: false, final_reason: error instanceof Error ? error.message : "Errore debug accesso" }, { status: 500 });
  }
}
