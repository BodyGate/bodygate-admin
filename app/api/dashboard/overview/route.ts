import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const bridgeBaseUrl =
  process.env.BODYGATE_BRIDGE_URL ||
  process.env.NEXT_PUBLIC_BODYGATE_BRIDGE_URL ||
  "http://127.0.0.1:5050";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function extractStaffName(reason?: string | null) {
  const text = String(reason || "");
  const prefix = "Accesso staff autorizzato:";

  if (text.includes(prefix)) {
    return text.split(prefix)[1]?.trim() || "Staff BodyGate";
  }

  return "";
}

function normalizeSubscriptionAlert(row: any) {
  const customer = Array.isArray(row.customers)
    ? row.customers[0]
    : row.customers;

  const firstName = customer?.first_name || "";
  const lastName = customer?.last_name || "";
  const customerName = `${firstName} ${lastName}`.trim();

  return {
    id: row.id,
    customer_id: row.customer_id,
    first_name: firstName,
    last_name: lastName,
    customer_name: customerName || row.customer_id,
    ends_at: row.ends_at,
  };
}

function normalizeAccessLog(row: any) {
  const customer = Array.isArray(row.customers)
    ? row.customers[0]
    : row.customers;

  const customerName = customer
    ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim()
    : "";

  const staffName = extractStaffName(row.reason);
  const isStaff = !!staffName;

  return {
    id: row.id,
    created_at: row.created_at || row.access_time,
    access_time: row.access_time || row.created_at,
    badge_code: row.badge_code,
    controller_code: row.controller_code,
    allowed: row.was_allowed ?? false,
    was_allowed: row.was_allowed ?? false,
    reason: row.reason,
    customer_id: row.customer_id,
    customer_name: isStaff ? staffName : customerName || null,
    display_name: isStaff ? staffName : customerName || null,
    entity_type: isStaff ? "staff" : "customer",
  };
}

async function fetchBridgeLiveStatus() {
  const normalizedBaseUrl = bridgeBaseUrl.replace(/\/+$/g, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    const response = await fetch(`${normalizedBaseUrl}/status`, {
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let json: any = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    return {
      ok: response.ok,
      status: response.ok ? "online" : "degraded",
      last_seen_at: new Date().toISOString(),
      raw: json,
      source: "bridge-live",
      bridge_base_url: normalizedBaseUrl,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error: any) {
    return {
      ok: false,
      status: "unknown",
      last_seen_at: null,
      raw: null,
      source: "bridge-live",
      bridge_base_url: normalizedBaseUrl,
      error: error?.message || "fetch failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  try {
    const todayIso = startOfToday();
    const monthIso = startOfMonth();
    const todayDate = todayIso.slice(0, 10);
    const plus15Date = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15)
      .toISOString()
      .slice(0, 10);

    const [
      customersResult,
      accessTodayResult,
      deniedTodayResult,
      paymentsTodayResult,
      paymentsMonthResult,
      latestCustomerAccessResult,
      expiredMedicalResult,
      expiringMedicalResult,
      expiredSubscriptionsResult,
      expiringSubscriptionsResult,
      activeBlocksResult,
      bridgeResult,
      bridgeLiveResult,
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      supabase
        .from("customer_access_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayIso),

      supabase
        .from("customer_access_logs")
        .select("id", { count: "exact", head: true })
        .eq("was_allowed", false)
        .gte("created_at", todayIso),

      supabase
        .from("payments")
        .select("amount, status, paid_at")
        .eq("status", "paid")
        .gte("paid_at", todayIso),

      supabase
        .from("payments")
        .select("amount, status, paid_at")
        .eq("status", "paid")
        .gte("paid_at", monthIso),

      supabase
        .from("customer_access_logs")
        .select(
          `
          id,
          created_at,
          access_time,
          badge_code,
          controller_code,
          was_allowed,
          reason,
          customer_id,
          customers (
            id,
            first_name,
            last_name
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(8),

      supabase
        .from("customers")
        .select("id, first_name, last_name, medical_certificate_end")
        .eq("is_active", true)
        .lt("medical_certificate_end", todayDate)
        .limit(6),

      supabase
        .from("customers")
        .select("id, first_name, last_name, medical_certificate_end")
        .eq("is_active", true)
        .gte("medical_certificate_end", todayDate)
        .lte("medical_certificate_end", plus15Date)
        .limit(6),

      supabase
        .from("customer_subscriptions")
        .select(
          `
          id,
          customer_id,
          ends_at,
          customers (
            id,
            first_name,
            last_name
          )
        `
        )
        .eq("is_active", true)
        .lt("ends_at", todayDate)
        .limit(6),

      supabase
        .from("customer_subscriptions")
        .select(
          `
          id,
          customer_id,
          ends_at,
          customers (
            id,
            first_name,
            last_name
          )
        `
        )
        .eq("is_active", true)
        .gte("ends_at", todayDate)
        .lte("ends_at", plus15Date)
        .limit(6),

      supabase
        .from("customer_blocks")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      supabase
        .from("bridge_status")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1),

      fetchBridgeLiveStatus(),
    ]);

    const paymentsToday = paymentsTodayResult.data || [];
    const paymentsMonth = paymentsMonthResult.data || [];

    const revenueToday = paymentsToday.reduce(
      (sum, row: any) => sum + Number(row.amount || 0),
      0
    );

    const revenueMonth = paymentsMonth.reduce(
      (sum, row: any) => sum + Number(row.amount || 0),
      0
    );

    const bridgeStored = bridgeResult.data?.[0] || null;

    const bridgeStatus =
      bridgeLiveResult.status === "online"
        ? "online"
        : bridgeLiveResult.status === "degraded"
          ? "degraded"
          : bridgeStored?.status || "unknown";

    const bridgeLastSeen =
      bridgeLiveResult.last_seen_at || bridgeStored?.created_at || null;

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      kpis: {
        active_customers: customersResult.count || 0,
        accesses_today: accessTodayResult.count || 0,
        denied_today: deniedTodayResult.count || 0,
        revenue_today: revenueToday,
        revenue_month: revenueMonth,
        active_blocks: activeBlocksResult.count || 0,
      },
      bridge: {
        status: bridgeStatus,
        last_seen_at: bridgeLastSeen,
        raw: bridgeLiveResult.raw || bridgeStored,
        source: bridgeLiveResult.ok ? "bridge-live" : "bridge-status-table",
        live: bridgeLiveResult,
        stored: bridgeStored,
      },
      alerts: {
        expired_medical: expiredMedicalResult.data || [],
        expiring_medical: expiringMedicalResult.data || [],
        expired_subscriptions: (expiredSubscriptionsResult.data || []).map(
          normalizeSubscriptionAlert
        ),
        expiring_subscriptions: (expiringSubscriptionsResult.data || []).map(
          normalizeSubscriptionAlert
        ),
      },
      latest_access: (latestCustomerAccessResult.data || []).map(
        normalizeAccessLog
      ),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore caricamento dashboard.",
      },
      { status: 500 }
    );
  }
}