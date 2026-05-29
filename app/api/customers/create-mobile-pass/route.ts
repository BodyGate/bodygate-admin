import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function makeToken() {
  const random = crypto.randomBytes(12).toString("base64url").toUpperCase();
  return `BGM_${random}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const customerId = String(body.customer_id || "").trim();

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id mancante" },
        { status: 400 }
      );
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("id, first_name, last_name, is_active")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json(
        { ok: false, error: "Cliente non trovato", detail: customerError },
        { status: 404 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("customer_mobile_passes")
      .select("*")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        ok: true,
        created: false,
        customer_id: customerId,
        public_token: existing.public_token,
        mobile_url: `/mobile/${existing.public_token}`,
      });
    }

    let token = makeToken();

    for (let i = 0; i < 5; i++) {
      const { data: tokenExists } = await supabaseAdmin
        .from("customer_mobile_passes")
        .select("id")
        .eq("public_token", token)
        .maybeSingle();

      if (!tokenExists) break;
      token = makeToken();
    }

    const { data: pass, error: passError } = await supabaseAdmin
      .from("customer_mobile_passes")
      .insert({
        customer_id: customerId,
        public_token: token,
        is_active: true,
      })
      .select("*")
      .single();

    if (passError || !pass) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore creazione mobile pass",
          detail: passError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      created: true,
      customer_id: customerId,
      public_token: pass.public_token,
      mobile_url: `/mobile/${pass.public_token}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore sconosciuto",
      },
      { status: 500 }
    );
  }
}
