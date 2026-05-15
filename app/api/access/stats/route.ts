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

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("access_logs")
      .select("id, allowed, open_warning, customer_id, direction, created_at")
      .gte("created_at", startOfDay.toISOString());

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const logs = data ?? [];

    const totalToday = logs.length;
    const allowedToday = logs.filter((log) => log.allowed === true).length;
    const deniedToday = logs.filter((log) => log.allowed === false).length;
    const warningsToday = logs.filter((log) => log.open_warning === true).length;

    const presentCustomerIds = new Set<string>();

    logs
      .filter((log) => log.allowed === true && log.customer_id)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      )
      .forEach((log) => {
        if (log.direction === "out") {
          presentCustomerIds.delete(log.customer_id);
        } else {
          presentCustomerIds.add(log.customer_id);
        }
      });

    return NextResponse.json({
      ok: true,
      stats: {
        total_today: totalToday,
        allowed_today: allowedToday,
        denied_today: deniedToday,
        warnings_today: warningsToday,
        present_now: presentCustomerIds.size,
      },
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