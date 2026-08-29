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

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(req.url);
    const branchId = String(searchParams.get("branch_id") || "").trim();

    if (!branchId) {
      return NextResponse.json(
        { ok: false, error: "branch_id mancante." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("accounting_entries")
      .select("*")
      .eq("branch_id", branchId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, entries: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento prima nota.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json().catch(() => ({}));
    const branchId = String(body.branch_id || "").trim();
    const category = String(body.category || "").trim();
    const amount = Number(body.amount);

    if (!branchId) {
      return NextResponse.json(
        { ok: false, error: "Seleziona una sede." },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { ok: false, error: "Inserisci la categoria." },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Inserisci un importo valido." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("accounting_entries").insert({
      branch_id: branchId,
      direction: body.direction === "expense" ? "expense" : "income",
      category,
      description: String(body.description || "").trim() || null,
      amount,
      payment_method: body.payment_method || "cash",
      entry_date: body.entry_date,
      source: "manual",
      operator_name: "Operatore",
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore salvataggio movimento.",
      },
      { status: 500 }
    );
  }
}
