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

    const [logsRes, customersRes] = await Promise.all([
      supabase
        .from("access_logs")
        .select("id, allowed, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("customers").select("id, active, subscription_status"),
    ]);

    if (logsRes.error) throw new Error(logsRes.error.message);
    if (customersRes.error) throw new Error(customersRes.error.message);

    return NextResponse.json({
      ok: true,
      logs: logsRes.data || [],
      customers: customersRes.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento analytics.",
      },
      { status: 500 }
    );
  }
}
