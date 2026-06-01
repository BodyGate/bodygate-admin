import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const customerId = String(body.customerId || "").trim();
    const reason = String(body.reason || "").trim();

    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Cliente mancante." }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ ok: false, error: "Motivo blocco mancante." }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { data: block, error } = await supabase
      .from("customer_blocks")
      .insert({
        customer_id: customerId,
        reason,
        is_active: true,
        created_at: now,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "block",
      title: "Cliente bloccato",
      description: reason,
      created_at: now,
    });

    return NextResponse.json({ ok: true, block_id: block.id });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Errore imprevisto." },
      { status: 500 }
    );
  }
}