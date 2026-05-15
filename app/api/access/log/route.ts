import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante nel file .env.local");
  }

  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante nel file .env.local");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "BodyGate Access Log API",
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json();

    const payload = {
      badge_code: body.badge_code ?? null,
      controller_code: body.controller_code ?? null,
      customer_id: body.customer_id ?? null,

      allowed: body.allowed === true,
      reason: body.reason ?? null,

      door: body.door ?? null,
      reader: body.reader ?? null,
      event_type: body.event_type ?? null,

      open_command_sent: body.open_command_sent === true,
      open_sdk_result: body.open_sdk_result === true,
      open_warning: body.open_warning === true,

      controller_ip: body.controller_ip ?? null,
      bridge_version: body.bridge_version ?? null,
    };

    const { data, error } = await supabase
      .from("access_logs")
      .insert(payload)
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      log_id: data.id,
      created_at: data.created_at,
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