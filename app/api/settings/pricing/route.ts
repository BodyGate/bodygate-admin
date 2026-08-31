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

    const [plansRes, servicesRes] = await Promise.all([
      supabase.from("subscription_plans").select("*").order("sort_order"),
      supabase
        .from("training_services")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (plansRes.error) throw new Error(plansRes.error.message);
    if (servicesRes.error) throw new Error(servicesRes.error.message);

    return NextResponse.json({
      ok: true,
      plans: plansRes.data || [],
      services: servicesRes.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Errore caricamento pricing.",
      },
      { status: 500 }
    );
  }
}
