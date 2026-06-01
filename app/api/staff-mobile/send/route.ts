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

function makeStaffToken() {
  return `BGS_${crypto.randomBytes(12).toString("base64url").toUpperCase()}`;
}

function makeStaffQrCode() {
  return `staff_${crypto.randomBytes(16).toString("base64url")}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const staffUserId = String(body.staff_user_id || body.staffUserId || "").trim();

    if (!staffUserId) {
      return NextResponse.json(
        { ok: false, error: "staff_user_id mancante" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: staffUser, error: staffError } = await supabase
      .from("staff_users")
      .select(
        `
        id,
        full_name,
        email,
        phone,
        is_active,
        role_id,
        staff_roles (
          role_key,
          role_name
        )
      `
      )
      .eq("id", staffUserId)
      .maybeSingle();

    if (staffError) throw staffError;

    if (!staffUser) {
      return NextResponse.json(
        { ok: false, error: "Utente staff non trovato" },
        { status: 404 }
      );
    }

    if (!staffUser.is_active) {
      return NextResponse.json(
        { ok: false, error: "Utente staff non attivo" },
        { status: 400 }
      );
    }

    if (!staffUser.phone) {
      return NextResponse.json(
        { ok: false, error: "Numero WhatsApp mancante nello staff" },
        { status: 400 }
      );
    }

    let { data: qrCredential, error: qrError } = await supabase
      .from("staff_access_credentials")
      .select("id, code, type, status")
      .eq("staff_user_id", staffUserId)
      .eq("type", "qr")
      .eq("status", "active")
      .maybeSingle();

    if (qrError) throw qrError;

    if (!qrCredential) {
      const qrCode = makeStaffQrCode();

      const { data: newQr, error: createQrError } = await supabase
        .from("staff_access_credentials")
        .insert({
          staff_user_id: staffUserId,
          type: "qr",
          code: qrCode,
          status: "active",
        })
        .select("id, code, type, status")
        .single();

      if (createQrError) throw createQrError;

      qrCredential = newQr;
    }

    let { data: mobilePass, error: passError } = await supabase
      .from("staff_mobile_passes")
      .select("id, public_token")
      .eq("staff_user_id", staffUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (passError) throw passError;

    if (!mobilePass) {
      const publicToken = makeStaffToken();

      const { data: newPass, error: createPassError } = await supabase
        .from("staff_mobile_passes")
        .insert({
          staff_user_id: staffUserId,
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
    const passUrl = `${appUrl}/staff-mobile/${mobilePass.public_token}`;

    const message =
      `Ciao ${staffUser.full_name || "staff"},\n\n` +
      `il tuo accesso staff Body Energy è stato attivato.\n\n` +
      `Puoi usare il tuo Staff Mobile Pass da questo link:\n${passUrl}\n\n` +
      `Aprilo e mostra il QR al lettore per accedere.\n\n` +
      `Body Energy ASD`;

    const whatsappUrl = `https://wa.me/${normalizePhone(
      staffUser.phone
    )}?text=${encodeURIComponent(message)}`;

    return NextResponse.json({
      ok: true,
      staff_user_id: staffUserId,
      staff_mobile_pass_id: mobilePass.id,
      public_token: mobilePass.public_token,
      pass_url: passUrl,
      qr_code: qrCredential.code,
      whatsapp_url: whatsappUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore invio Staff Mobile Pass",
      },
      { status: 500 }
    );
  }
}