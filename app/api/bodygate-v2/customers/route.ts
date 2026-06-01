import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();
  let query = supabase.from("bg_v2_customers_crm").select("*").order("created_at", { ascending: false }).limit(2000);
  if (q) query = query.or(`display_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,badge_code.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = data || [];
  return NextResponse.json({ ok: true, customers: rows, metrics: { total: rows.length, active: rows.filter((r:any)=>r.access_state === "active").length, expiring: rows.filter((r:any)=>r.access_state === "expiring").length, critical: rows.filter((r:any)=>["expired","blocked","suspended"].includes(r.access_state)).length }});
}
