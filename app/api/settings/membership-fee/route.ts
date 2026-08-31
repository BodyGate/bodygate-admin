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
      .from("membership_fee_settings")
      .select("*")
      .eq("branch_id", branchId)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, fee: data || null });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento quota associativa.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "id mancante." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("membership_fee_settings")
      .update({
        name: body.name,
        price: body.price,
        validity_days: body.validity_days,
        required_for_access: body.required_for_access,
        is_active: body.is_active,
      })
      .eq("id", id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore aggiornamento quota associativa.",
      },
      { status: 500 }
    );
  }
}
