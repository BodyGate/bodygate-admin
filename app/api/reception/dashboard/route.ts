import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, supabaseServiceKey);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const today = todayString();
    const in30Days = addDays(30);

    const [customersRes, logsRes, certificatesRes, subscriptionsRes, gymPresenceRes] =
      await Promise.all([
        supabase
          .from("customers")
          .select(
            "id, first_name, last_name, is_active, medical_certificate_start_date, medical_certificate_end_date, medical_certificate_status, medical_certificate_start, medical_certificate_end"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("customer_access_logs")
          .select(
            `
            id,
            created_at,
            access_time,
            customer_id,
            badge_code,
            controller_code,
            was_allowed,
            reason,
            customers (
              first_name,
              last_name
            )
          `
          )
          .gte("created_at", `${today}T00:00:00`)
          .order("created_at", { ascending: false })
          .limit(120),

        supabase
          .from("customers")
          .select(
            "id, first_name, last_name, is_active, medical_certificate_start_date, medical_certificate_end_date, medical_certificate_status, medical_certificate_start, medical_certificate_end"
          )
          .eq("is_active", true)
          .gte("medical_certificate_end_date", today)
          .lte("medical_certificate_end_date", in30Days)
          .order("medical_certificate_end_date", { ascending: true })
          .limit(20),

        supabase
          .from("customer_subscriptions")
          .select(
            `
            id,
            customer_id,
            starts_at,
            ends_at,
            is_active,
            customers (
              first_name,
              last_name
            )
          `
          )
          .eq("is_active", true)
          .lte("ends_at", in30Days)
          .order("ends_at", { ascending: true })
          .limit(120),

        supabase
          .from("gym_presence")
          .select("id, customer_id, badge_code, is_inside, updated_at")
          .order("updated_at", { ascending: false })
          .limit(120),
      ]);

    const firstError =
      customersRes.error ||
      logsRes.error ||
      certificatesRes.error ||
      subscriptionsRes.error ||
      gymPresenceRes.error;

    return NextResponse.json({
      ok: true,
      error: firstError?.message || "",
      customers: customersRes.data || [],
      logs: logsRes.data || [],
      certificates: certificatesRes.data || [],
      subscriptions: subscriptionsRes.data || [],
      gymPresence: gymPresenceRes.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento dashboard reception.",
      },
      { status: 500 }
    );
  }
}
