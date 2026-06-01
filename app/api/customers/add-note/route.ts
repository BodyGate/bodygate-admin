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
    const note = String(body.note || "").trim();

    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Cliente mancante." }, { status: 400 });
    }

    if (!note) {
      return NextResponse.json({ ok: false, error: "Nota vuota." }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { error: noteError } = await supabase.from("customer_internal_notes").insert({
      customer_id: customerId,
      note,
      created_by: "admin@bodygate.it",
      created_at: now,
    });

    if (noteError) {
      return NextResponse.json({ ok: false, error: noteError.message }, { status: 500 });
    }

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "note",
      title: "Nota interna aggiunta",
      description: note,
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