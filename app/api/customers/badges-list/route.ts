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

    const { data, error } = await supabase
      .from("customers")
      .select(
        `
        id,
        full_name,
        badge_code,
        active,
        subscription_status,
        subscription_expiry
      `
      )
      .not("badge_code", "is", null)
      .order("full_name", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, customers: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Errore caricamento badge.",
      },
      { status: 500 }
    );
  }
}
