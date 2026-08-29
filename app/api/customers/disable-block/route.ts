import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, supabaseServiceKey);
}

const supabase = getSupabaseClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const customerId = String(body.customerId || "").trim();
    const blockId = String(body.blockId || "").trim();

    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Cliente mancante." }, { status: 400 });
    }

    if (!blockId) {
      return NextResponse.json({ ok: false, error: "Blocco mancante." }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("customer_blocks")
      .update({
        is_active: false,
        updated_at: now,
      })
      .eq("id", blockId)
      .eq("customer_id", customerId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "block",
      title: "Blocco cliente disattivato",
      description: "Blocco cliente rimosso dalla scheda cliente.",
      created_at: now,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Errore imprevisto." },
      { status: 500 }
    );
  }
}