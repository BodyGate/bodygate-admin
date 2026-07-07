import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurazione Supabase server mancante");
  return createClient(url, key, { auth: { persistSession: false } });
}

function fail(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function listTrainingData() {
  const supabase = serverSupabase();
  const [programs, customers, exercises, sessions] = await Promise.all([
    supabase.from("training_programs").select("id, customer_id, title, description, coach_name, goal, is_active, starts_at, ends_at, created_at, customers(first_name,last_name)").order("created_at", { ascending: false }),
    supabase.from("customers").select("id, first_name, last_name, email, phone, is_active, status").order("last_name", { ascending: true }),
    supabase.from("exercises").select("id, name, muscle_group, equipment, difficulty, machine_brand, machine_name, machine_code, thumbnail_url, video_url, instructions, is_active, created_at").order("name", { ascending: true }),
    supabase.from("workout_sessions").select("id, program_id, customer_id, status, started_at, completed_at, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const firstError = programs.error || customers.error || exercises.error || sessions.error;
  if (firstError) throw new Error(firstError.message);
  return { programs: programs.data ?? [], customers: customers.data ?? [], exercises: exercises.data ?? [], sessions: sessions.data ?? [] };
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: await listTrainingData() });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Errore lettura Training");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = serverSupabase();
    const body = (await request.json()) as JsonRecord;
    const action = String(body.action || "");
    if (action === "create-program") {
      const { data, error } = await supabase.rpc("create_training_program_atomic", { payload: body.payload });
      if (error) return fail(`RPC atomica create_training_program_atomic non disponibile o fallita: ${error.message}`, 409);
      return NextResponse.json({ ok: true, data });
    }
    if (action === "save-exercise") {
      const payload = body.payload as JsonRecord | undefined;
      if (!payload?.name || typeof payload.name !== "string") return fail("Nome esercizio obbligatorio", 400);
      const { data, error } = await supabase.from("exercises").insert(payload).select("*").single();
      if (error) return fail(error.message, 400);
      return NextResponse.json({ ok: true, data });
    }
    if (action === "toggle") {
      const table = String(body.table || "");
      if (!["training_programs", "exercises"].includes(table)) return fail("Tabella non consentita", 400);
      const { error } = await supabase.from(table).update({ is_active: Boolean(body.is_active) }).eq("id", String(body.id || ""));
      if (error) return fail(error.message, 400);
      return NextResponse.json({ ok: true });
    }
    return fail("Azione training non supportata", 400);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Errore mutazione Training");
  }
}
