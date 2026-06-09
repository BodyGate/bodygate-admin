import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function createPublicToken() {
  return crypto.randomBytes(24).toString("hex");
}

function getAppUrl(req: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

  if (envUrl) return envUrl.replace(/\/$/, "");

  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const customerId = String(body.customer_id || body.customerId || "").trim();

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id mancante" },
        { status: 400 }
      );
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("id, first_name, last_name, phone, is_active")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cliente non trovato",
          detail: customerError?.message || null,
        },
        { status: 404 }
      );
    }

    const { data: existingPass, error: existingError } = await supabaseAdmin
      .from("customer_mobile_passes")
      .select("id, customer_id, public_token, is_active, created_at")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore lettura Mobile Pass esistente",
          detail: existingError.message,
        },
        { status: 500 }
      );
    }

    const appUrl = getAppUrl(req);

    if (existingPass?.public_token) {
      const mobileUrl = `/mobile/${existingPass.public_token}`;

      return NextResponse.json({
        ok: true,
        created: false,
        customer_id: customerId,
        public_token: existingPass.public_token,
        mobile_url: mobileUrl,
        pass_url: `${appUrl}${mobileUrl}`,
      });
    }

    const publicToken = createPublicToken();

    const { data: insertedPass, error: insertError } = await supabaseAdmin
      .from("customer_mobile_passes")
      .insert({
        customer_id: customerId,
        public_token: publicToken,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select("id, customer_id, public_token, is_active, created_at")
      .single();

    if (insertError || !insertedPass) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore creazione Mobile Pass",
          detail: insertError?.message || null,
        },
        { status: 500 }
      );
    }

    const mobileUrl = `/mobile/${insertedPass.public_token}`;

    await supabaseAdmin.from("customer_timeline").insert({
      customer_id: customerId,
      type: "mobile_pass_created",
      title: "Mobile Pass creato",
      description: `Mobile Pass creato: ${mobileUrl}`,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      created: true,
      customer_id: customerId,
      public_token: insertedPass.public_token,
      mobile_url: mobileUrl,
      pass_url: `${appUrl}${mobileUrl}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore creazione Mobile Pass",
      },
      { status: 500 }
    );
  }
}