import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

    let query = await supabase
      .from("customers")
      .select(
        "id, first_name, last_name, full_name, email, phone, badge_code, subscription_status, subscription_expiry, active, created_at"
      )
      .order("created_at", { ascending: false });

    if (query.error) {
      query = await supabase
        .from("customers")
        .select(
          "id, first_name, last_name, full_name, email, phone, badge_code, subscription_status, subscription_expiry, active, created_at"
        );
    }

    if (query.error) {
      return NextResponse.json(
        { ok: false, error: query.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      customers: query.data ?? [],
      count: query.data?.length ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore interno";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
