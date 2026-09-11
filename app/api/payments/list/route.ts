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

    const [{ data, error }, { count: totalCount, error: countError }] =
      await Promise.all([
        supabase
          .from("payments")
          .select(
            `
            id,
            customer_id,
            amount,
            payment_type,
            description,
            status,
            paid_at,
            created_at,
            customers (
              first_name,
              last_name
            ),
            payment_methods (
              name,
              method_key
            )
          `
          )
          .order("paid_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false })
          .limit(100),

        // Real total so the client can tell whether the 100-row page above
        // is the whole history or a truncated view - the KPI cards sum
        // only what's loaded, and silently look like a full total once
        // monthly volume passes the cap.
        supabase.from("payments").select("id", { count: "exact", head: true }),
      ]);

    if (error) throw new Error(error.message);
    if (countError) throw new Error(countError.message);

    return NextResponse.json({
      ok: true,
      payments: data || [],
      total_count: totalCount ?? (data || []).length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento pagamenti.",
      },
      { status: 500 }
    );
  }
}
