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
  let cleaned = phone.replace(/\D/g, "");

  if (!cleaned || cleaned.length < 8) {
    throw new Error("Numero WhatsApp staff non valido");
  }

  if (cleaned.startsWith("00")) {
    cleaned = cleaned.slice(2);
  }

  if (!cleaned || cleaned.length < 8) {
    throw new Error("Numero WhatsApp staff non valido");
  }

  if (cleaned.startsWith("39")) return cleaned;
  if (cleaned.startsWith("3")) return `39${cleaned}`;
  if (cleaned.startsWith("0")) return `39${cleaned}`;
  return cleaned;
}

function getPublicAppUrl() {
  return (
    process.env.NEXT_PUBLIC_BODYGATE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://bodygate-admin.vercel.app"
  ).replace(/\/$/, "");
}

function getLocalApiUrl() {
  return (process.env.BODYGATE_LOCAL_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

function makeStaffToken() {
  return `BGS_${crypto.randomBytes(12).toString("base64url").toUpperCase()}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const staffUserId = String(
      body.staff_user_id || body.staffUserId || ""
    ).trim();

    if (!staffUserId) {
      return NextResponse.json(
        { ok: false, error: "staff_user_id mancante" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: staffUser, error: staffError } = await supabase
      .from("staff_users")
      .select("id, full_name, email, phone, is_active, role_id")
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
      .like("code", "local_user=%")
      .maybeSingle();

    if (qrError) throw qrError;

    if (!qrCredential?.code) {
      const localApiUrl = getLocalApiUrl();

      const createQrRes = await fetch(
        `${localApiUrl}/api/dnake/create-staff-qr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            staff_user_id: staffUserId,
          }),
        }
      );

      const createQrText = await createQrRes.text();

      let createQrJson: any = null;

      try {
        createQrJson = JSON.parse(createQrText);
      } catch {
        return NextResponse.json(
          {
            ok: false,
            error:
              "La route locale /api/dnake/create-staff-qr non ha restituito JSON valido.",
            status: createQrRes.status,
            response: createQrText.slice(0, 500),
          },
          { status: 500 }
        );
      }

      if (!createQrRes.ok || !createQrJson.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: createQrJson.error || "Errore creazione QR DNake staff",
            detail: createQrJson,
          },
          { status: 500 }
        );
      }

      const { data: refreshedQr, error: refreshedQrError } = await supabase
        .from("staff_access_credentials")
        .select("id, code, type, status")
        .eq("staff_user_id", staffUserId)
        .eq("type", "qr")
        .eq("status", "active")
        .like("code", "local_user=%")
        .maybeSingle();

      if (refreshedQrError) throw refreshedQrError;

      qrCredential = refreshedQr;
    }

    if (!qrCredential?.code) {
      return NextResponse.json(
        {
          ok: false,
          error: "QR DNake staff non disponibile dopo la generazione.",
        },
        { status: 500 }
      );
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

    let phoneNormalized: string;

    try {
      phoneNormalized = normalizePhone(staffUser.phone);
    } catch (error: any) {
      return NextResponse.json(
        { ok: false, error: error?.message || "Numero WhatsApp staff non valido" },
        { status: 400 }
      );
    }

    const publicAppUrl = getPublicAppUrl();
    const passUrl = `${publicAppUrl}/staff-mobile/${mobilePass.public_token}`;

    const message =
      `Ciao ${staffUser.full_name || "staff"},\n\n` +
      `il tuo accesso staff Body Energy è stato attivato.\n\n` +
      `Puoi usare il tuo Staff Mobile Pass da questo link:\n${passUrl}\n\n` +
      `Aprilo e mostra il QR DNake al lettore per accedere.\n\n` +
      `Body Energy ASD`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNormalized}?text=${encodedMessage}`;
    const whatsappWebUrl = `https://web.whatsapp.com/send?phone=${phoneNormalized}&text=${encodedMessage}`;

    return NextResponse.json({
      ok: true,
      staff_user_id: staffUserId,
      staff_mobile_pass_id: mobilePass.id,
      public_token: mobilePass.public_token,
      phone_normalized: phoneNormalized,
      pass_url: passUrl,
      qr_code: qrCredential.code,
      whatsapp_url: whatsappUrl,
      whatsapp_web_url: whatsappWebUrl,
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