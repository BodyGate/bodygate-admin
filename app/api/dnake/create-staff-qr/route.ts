import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const DNAKE_IP = process.env.DNAKE_IP || "192.168.1.179";
const DNAKE_USERNAME = process.env.DNAKE_USERNAME || "admin";
const DNAKE_PASSWORD_MD5 = process.env.DNAKE_PASSWORD_MD5 || "";

function safeStaffName(fullName?: string | null) {
  return String(fullName || "BodyGate Staff").trim().slice(0, 26);
}

function makeDnakeStaffUserId(staffUserId: string) {
  const numbers = staffUserId.replace(/\D/g, "");
  const fallback = Date.now().toString().slice(-6);
  return (numbers || fallback).slice(0, 6);
}

function extractSessionId(setCookie: string | null) {
  if (!setCookie) return "";
  const match = setCookie.match(/SessionID=([^;]+)/i);
  return match?.[1] || "";
}

async function dnakeLogin() {
  if (!DNAKE_PASSWORD_MD5) {
    throw new Error("DNAKE_PASSWORD_MD5 mancante in .env.local");
  }

  const loginUrl = `http://${DNAKE_IP}/cgi-bin/webapi.cgi?api=login&username=${encodeURIComponent(
    DNAKE_USERNAME
  )}&password=${encodeURIComponent(DNAKE_PASSWORD_MD5)}`;

  const res = await fetch(loginUrl, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      pragma: "no-cache",
    },
  });

  const text = await res.text();
  const sessionId = extractSessionId(res.headers.get("set-cookie"));

  if (!res.ok || !sessionId) {
    throw new Error(`Login DNake fallito. Status=${res.status}. Response=${text}`);
  }

  return sessionId;
}

function dnakeHeaders(sessionId: string) {
  return {
    Cookie: `SessionID=${sessionId}`,
    Accept: "application/json, text/plain, */*",
  };
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

    const { data: staffUser, error: staffError } = await supabaseAdmin
      .from("staff_users")
      .select("id, full_name, email, phone, is_active")
      .eq("id", staffUserId)
      .maybeSingle();

    if (staffError || !staffUser) {
      return NextResponse.json(
        { ok: false, error: "Utente staff non trovato", detail: staffError },
        { status: 404 }
      );
    }

    if (staffUser.is_active === false) {
      return NextResponse.json(
        { ok: false, error: "Utente staff non attivo" },
        { status: 400 }
      );
    }

    const sessionId = await dnakeLogin();

    const dnakeName = safeStaffName(staffUser.full_name);
    const dnakeUserId = makeDnakeStaffUserId(staffUser.id);
    const qrcodeTimestamp = Math.floor(Date.now() / 1000).toString();

    const form = new FormData();
    form.append("pass_enable", "0");
    form.append("active_enable", "0");
    form.append("group", "-1");
    form.append("action", "1");
    form.append("id", dnakeUserId);
    form.append("name", dnakeName);
    form.append("room", "");
    form.append("relays", "0");
    form.append("status", "1");
    form.append("type", "0");
    form.append("cards", "");
    form.append("pin_code", "");
    form.append("gender", "2");
    form.append("qrcode_timestamp", qrcodeTimestamp);
    form.append("picture", "");

    const createUserRes = await fetch(
      `http://${DNAKE_IP}/cgi-bin/webapi.cgi?api=user`,
      {
        method: "POST",
        headers: dnakeHeaders(sessionId),
        body: form,
      }
    );

    const createUserText = await createUserRes.text();

    if (!createUserRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore creazione utente staff DNake",
          status: createUserRes.status,
          response: createUserText,
        },
        { status: 502 }
      );
    }

    const qrRes = await fetch(
      `http://${DNAKE_IP}/cgi-bin/webapi.cgi?api=user_qrcode&qrcode=${encodeURIComponent(
        `${dnakeUserId}_${qrcodeTimestamp}`
      )}`,
      {
        method: "GET",
        headers: dnakeHeaders(sessionId),
      }
    );

    const qrText = await qrRes.text();

    let qrJson: any = null;
    try {
      qrJson = JSON.parse(qrText);
    } catch {
      qrJson = null;
    }

    if (!qrRes.ok || !qrJson?.qrcode) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore generazione QR staff DNake",
          status: qrRes.status,
          response: qrText,
        },
        { status: 502 }
      );
    }

    const qrPayload = String(qrJson.qrcode);
    const now = new Date().toISOString();

    const { error: dnakeSaveError } = await supabaseAdmin
      .from("staff_dnake_users")
      .upsert(
        {
          staff_user_id: staffUserId,
          dnake_user_id: dnakeUserId,
          dnake_name: dnakeName,
          qrcode_timestamp: qrcodeTimestamp,
          qr_payload: qrPayload,
          qr_status: "active",
          updated_at: now,
        },
        { onConflict: "dnake_user_id" }
      );

    if (dnakeSaveError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore salvataggio staff_dnake_users",
          detail: dnakeSaveError,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("staff_access_credentials")
      .update({ status: "inactive" })
      .eq("staff_user_id", staffUserId)
      .eq("type", "qr")
      .eq("status", "active");

    const { error: credentialError } = await supabaseAdmin
      .from("staff_access_credentials")
      .insert({
        staff_user_id: staffUserId,
        type: "qr",
        code: qrPayload,
        controller_code: dnakeUserId,
        status: "active",
      });

    if (credentialError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore salvataggio staff_access_credentials",
          detail: credentialError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      staff_user_id: staffUserId,
      dnake_user_id: dnakeUserId,
      dnake_name: dnakeName,
      qrcode_timestamp: qrcodeTimestamp,
      qr_payload: qrPayload,
      controller_code: dnakeUserId,
      dnake_create_response: createUserText,
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