import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase env mancante");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "ID utente staff mancante.",
        },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {};

    if (typeof body.full_name === "string") {
      updatePayload.full_name = body.full_name.trim();
    }

    if (typeof body.email === "string") {
      updatePayload.email = body.email.trim().toLowerCase();
    }

    if (typeof body.role_id === "string") {
      updatePayload.role_id = body.role_id;
    }

    if (typeof body.is_active === "boolean") {
      updatePayload.is_active = body.is_active;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nessun dato da aggiornare.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("staff_users")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore aggiornamento staff",
      },
      { status: 500 }
    );
  }
}