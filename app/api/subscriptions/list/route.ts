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
      .from("customer_subscriptions")
      .select(
        `
        id,
        customer_id,
        starts_at,
        ends_at,
        is_active,
        amount,
        created_at,
        customers (
          id,
          first_name,
          last_name,
          phone,
          badge_code,
          is_active
        ),
        subscription_plans (
          id,
          name,
          is_active
        )
      `
      )
      .order("created_at", { ascending: false })
      .order("starts_at", { ascending: false })
      .order("ends_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, subscriptions: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento abbonamenti.",
      },
      { status: 500 }
    );
  }
}
