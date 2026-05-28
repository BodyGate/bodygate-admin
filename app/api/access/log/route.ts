import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type AccessLogResult = "allowed" | "denied" | "error";

function normalizeResult(body: Record<string, unknown>): AccessLogResult {
  if (
    body.result === "allowed" ||
    body.result === "denied" ||
    body.result === "error"
  ) {
    return body.result;
  }

  if (
    body.error ||
    body.open_warning === true ||
    (body.open_command_sent === true && body.open_sdk_result === false)
  ) {
    return "error";
  }

  return body.allowed === true ? "allowed" : "denied";
}

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

function methodNotAllowed(method: string) {
  return NextResponse.json(
    {
      ok: false,
      error: `Method ${method} not allowed`,
    },
    {
      status: 405,
      headers: {
        Allow: "GET, POST, OPTIONS",
      },
    }
  );
}

export async function OPTIONS() {
  return NextResponse.json(
    {
      ok: true,
      methods: ["GET", "POST", "OPTIONS"],
    },
    {
      headers: {
        Allow: "GET, POST, OPTIONS",
      },
    }
  );
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
      result: normalizeResult(body),
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
      result: payload.result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Errore interno";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return methodNotAllowed(req.method);
}

export async function PATCH(req: NextRequest) {
  return methodNotAllowed(req.method);
}

export async function DELETE(req: NextRequest) {
  return methodNotAllowed(req.method);
}
