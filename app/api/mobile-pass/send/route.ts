import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("39")) return cleaned;
  if (cleaned.startsWith("0")) return `39${cleaned}`;
  return `39${cleaned}`;
}

function getPublicAppUrl() {
  return (
    process.env.NEXT_PUBLIC_BODYGATE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://bodygate-admin.vercel.app"
  ).replace(/\/$/, "");
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

    const supabase = getSupabaseAdmin();

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, first_name, last_name, phone, is_active")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError) throw customerError;

    if (!customer) {
      return NextResponse.json(
        { ok: false, error: "Cliente non trovato" },
        { status: 404 }
      );
    }

    if (!customer.phone) {
      return NextResponse.json(
        { ok: false, error: "Numero WhatsApp mancante nel cliente" },
        { status: 400 }
      );
    }

    const { data: qrCredential, error: credentialError } = await supabase
      .from("access_credentials")
      .select("id, code, status, type")
      .eq("customer_id", customerId)
      .eq("type", "qr")
      .eq("status", "active")
      .maybeSingle();

    if (credentialError) throw credentialError;

    if (!qrCredential?.code) {
      return NextResponse.json(
        { ok: false, error: "Credenziale QR attiva non trovata" },
        { status: 400 }
      );
    }

    let { data: mobilePass, error: passError } = await supabase
      .from("customer_mobile_passes")
      .select("id, public_token")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .maybeSingle();

    if (passError) throw passError;

    if (!mobilePass) {
      const publicToken = `BGM_${crypto
        .randomBytes(12)
        .toString("base64url")
        .toUpperCase()}`;

      const { data: newPass, error: createPassError } = await supabase
        .from("customer_mobile_passes")
        .insert({
          customer_id: customerId,
          public_token: publicToken,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .select("id, public_token")
        .single();

      if (createPassError) throw createPassError;

      mobilePass = newPass;
    }

    const appUrl = getPublicAppUrl();
    const passUrl = `${appUrl}/mobile/${mobilePass.public_token}`;

    const firstName = customer.first_name || "cliente";

    const message =
      `Ciao ${firstName},\n\n` +
      `il tuo accesso Body Energy è stato attivato.\n\n` +
      `Puoi usare il tuo Mobile Pass da questo link:\n${passUrl}\n\n` +
      `Aprilo e mostra il QR al lettore per entrare in palestra.\n\n` +
      `Body Energy ASD`;

    const whatsappUrl = `https://wa.me/${normalizePhone(
      customer.phone
    )}?text=${encodeURIComponent(message)}`;

    return NextResponse.json({
      ok: true,
      customer_id: customerId,
      mobile_pass_id: mobilePass.id,
      public_token: mobilePass.public_token,
      pass_url: passUrl,
      qr_code: qrCredential.code,
      whatsapp_url: whatsappUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore invio Mobile Pass",
      },
      { status: 500 }
    );
  }
}