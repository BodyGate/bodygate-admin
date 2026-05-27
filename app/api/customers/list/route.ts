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

    const customerFields =
      "id, first_name, last_name, phone, email, fiscal_code, is_active, created_at";

    let query = await supabase
      .from("customers")
      .select(customerFields)
      .order("created_at", { ascending: false });

    if (query.error) {
      query = await supabase.from("customers").select(customerFields);
    }

    if (query.error) {
      return NextResponse.json(
        { ok: false, error: query.error.message },
        { status: 500 }
      );
    }

    const customers = (query.data ?? []).map((customer) => ({
      ...customer,
      full_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
      active: customer.is_active,
    }));

    return NextResponse.json({
      ok: true,
      customers,
      count: customers.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore interno";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
