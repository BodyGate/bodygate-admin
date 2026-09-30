import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { evaluateAccessSilence } from "../../../lib/server/accessSilence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
    if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("customer_access_logs")
      .select("access_time")
      .order("access_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const lastAccessAt: string | null = data?.access_time ?? null;
    const silence = evaluateAccessSilence({ lastAccessAt, now: new Date() });

    return NextResponse.json({ ok: true, lastAccessAt, ...silence });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Errore interno" },
      { status: 500 }
    );
  }
}
