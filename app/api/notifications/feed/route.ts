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

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const [customersRes, subscriptionsRes, membershipFeesRes, blocksRes, unknownBadgesRes] =
      await Promise.all([
        supabase.from("customers").select("*").eq("is_active", true),
        supabase
          .from("customer_subscriptions")
          .select("*, customers(first_name,last_name)")
          .eq("is_active", true),
        supabase
          .from("customer_membership_fees")
          .select("*, customers(first_name,last_name)"),
        supabase
          .from("customer_blocks")
          .select("*, customers(first_name,last_name)")
          .eq("is_active", true),
        supabase
          .from("unknown_badge_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    return NextResponse.json({
      ok: true,
      customers: customersRes.data || [],
      subscriptions: subscriptionsRes.data || [],
      membershipFees: membershipFeesRes.data || [],
      blocks: blocksRes.data || [],
      unknownBadges: unknownBadgesRes.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento notifiche.",
      },
      { status: 500 }
    );
  }
}
