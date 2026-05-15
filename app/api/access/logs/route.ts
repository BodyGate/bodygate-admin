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

    const { data: logs, error: logsError } = await supabase
      .from("access_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (logsError) {
      return NextResponse.json(
        { ok: false, error: logsError.message },
        { status: 500 }
      );
    }

    const customerIds = [
      ...new Set(
        (logs ?? [])
          .map((log) => log.customer_id)
          .filter(Boolean)
      ),
    ];

    let customers: any[] = [];

    if (customerIds.length > 0) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, photo_url, status")
        .in("id", customerIds);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }

      customers = data ?? [];
    }

    const logsWithCustomers = (logs ?? []).map((log) => {
      const customer = customers.find((c) => c.id === log.customer_id);

      return {
        ...log,
        customer: customer ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      logs: logsWithCustomers,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Errore interno",
      },
      { status: 500 }
    );
  }
}