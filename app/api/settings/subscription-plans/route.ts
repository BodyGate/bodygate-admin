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

    const [categoriesRes, plansRes] = await Promise.all([
      supabase
        .from("subscription_categories")
        .select("id, name")
        .eq("branch_id", branchId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("subscription_plans")
        .select("*")
        .eq("branch_id", branchId)
        .order("sort_order", { ascending: true }),
    ]);

    if (categoriesRes.error) throw new Error(categoriesRes.error.message);
    if (plansRes.error) throw new Error(plansRes.error.message);

    return NextResponse.json({
      ok: true,
      categories: categoriesRes.data || [],
      plans: plansRes.data || [],
    });
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

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json().catch(() => ({}));
    const branchId = String(body.branch_id || "").trim();

    if (!branchId) {
      return NextResponse.json(
        { ok: false, error: "branch_id mancante." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("subscription_plans").insert({
      branch_id: branchId,
      category_id: body.category_id || null,
      name: "Nuovo abbonamento",
      price: 0,
      duration_days: 30,
      is_active: true,
      sort_order: body.sort_order ?? 0,
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
            : "Errore creazione abbonamento.",
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

    const { error } = await supabase
      .from("subscription_plans")
      .update({
        name: body.name,
        price: body.price,
        duration_days: body.duration_days,
        is_active: body.is_active,
        category_id: body.category_id,
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
            : "Errore aggiornamento abbonamento.",
      },
      { status: 500 }
    );
  }
}
