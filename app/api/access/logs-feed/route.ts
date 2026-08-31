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
      .from("customer_access_logs")
      .select(
        `
        id,
        access_time,
        customer_id,
        branch_id,
        was_allowed,
        reason,
        badge_code,
        controller_code,
        customers (
          first_name,
          last_name
        )
      `
      )
      .order("access_time", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, logs: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento access logs.",
      },
      { status: 500 }
    );
  }
}
