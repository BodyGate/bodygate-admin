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

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "edit" ? "edit" : "create";
    const customerId = String(body.customer_id || "").trim();
    const payload = body.payload || {};

    if (mode === "edit") {
      if (!customerId) {
        return NextResponse.json(
          { ok: false, error: "customer_id mancante." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", customerId);

      if (error) throw new Error(error.message);

      return NextResponse.json({ ok: true, id: customerId });
    }

    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Errore salvataggio cliente.",
      },
      { status: 500 }
    );
  }
}
