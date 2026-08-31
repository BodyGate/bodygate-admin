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

    let query = supabase
      .from("subscription_plans")
      .select(
        "id, branch_id, name, price, promo_price, duration_days, sort_order, is_active"
      )
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, plans: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Errore caricamento piani.",
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

    if (!branchId) {
      return NextResponse.json(
        { ok: false, error: "Seleziona una sede prima di creare un piano." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("subscription_plans").insert({
      branch_id: branchId,
      name: String(body.name || "").trim(),
      price: Number(body.price),
      promo_price:
        body.promo_price === null || body.promo_price === undefined
          ? null
          : Number(body.promo_price),
      duration_days: Number(body.duration_days),
      sort_order: Number(body.sort_order),
      is_active: Boolean(body.is_active),
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Creazione piano non riuscita.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
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

    const update: Record<string, unknown> = {};

    if (body.name !== undefined) update.name = String(body.name || "").trim();
    if (body.price !== undefined) update.price = Number(body.price);
    if (body.promo_price !== undefined) {
      update.promo_price =
        body.promo_price === null ? null : Number(body.promo_price);
    }
    if (body.duration_days !== undefined)
      update.duration_days = Number(body.duration_days);
    if (body.sort_order !== undefined)
      update.sort_order = Number(body.sort_order);
    if (body.is_active !== undefined)
      update.is_active = Boolean(body.is_active);

    const { error } = await supabase
      .from("subscription_plans")
      .update(update)
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
            : "Aggiornamento piano non riuscito.",
      },
      { status: 500 }
    );
  }
}
