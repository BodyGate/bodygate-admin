import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export async function GET() {
  try {
    const todayIso = startOfToday();
    const monthIso = startOfMonth();
    const todayDate = todayIso.slice(0, 10);

    const [
      customersResult,
      accessTodayResult,
      deniedTodayResult,
      paymentsTodayResult,
      paymentsMonthResult,
      latestAccessResult,
      expiredMedicalResult,
      expiringMedicalResult,
      expiredSubscriptionsResult,
      expiringSubscriptionsResult,
      activeBlocksResult,
      bridgeResult,
    ] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),

      supabase
        .from("access_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayIso),

      supabase
        .from("access_logs")
        .select("id", { count: "exact", head: true })
        .eq("allowed", false)
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
        .from("access_logs")
        .select("id, created_at, badge_code, controller_code, allowed, reason, customer_id")
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
        .lte(
          "medical_certificate_end",
          new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString().slice(0, 10)
        )
        .limit(6),

      supabase
        .from("customer_subscriptions")
        .select("id, customer_id, ends_at")
        .eq("is_active", true)
        .lt("ends_at", todayDate)
        .limit(6),

      supabase
        .from("customer_subscriptions")
        .select("id, customer_id, ends_at")
        .eq("is_active", true)
        .gte("ends_at", todayDate)
        .lte(
          "ends_at",
          new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString().slice(0, 10)
        )
        .limit(6),

      supabase
        .from("customer_blocks")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      supabase.from("bridge_status").select("*").order("created_at", { ascending: false }).limit(1),
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

    const bridge = bridgeResult.data?.[0] || null;

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
        status: bridge?.status || "unknown",
        last_seen_at: bridge?.created_at || null,
        raw: bridge,
      },
      alerts: {
        expired_medical: expiredMedicalResult.data || [],
        expiring_medical: expiringMedicalResult.data || [],
        expired_subscriptions: expiredSubscriptionsResult.data || [],
        expiring_subscriptions: expiringSubscriptionsResult.data || [],
      },
      latest_access: latestAccessResult.data || [],
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