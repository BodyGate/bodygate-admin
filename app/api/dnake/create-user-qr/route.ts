import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const DNAKE_IP = process.env.DNAKE_IP || "192.168.1.179";
const DNAKE_USERNAME = process.env.DNAKE_USERNAME || "admin";
const DNAKE_PASSWORD_MD5 = process.env.DNAKE_PASSWORD_MD5 || "";

function safeName(firstName?: string | null, lastName?: string | null) {
  const name = `${firstName || ""} ${lastName || ""}`.trim();
  return name.slice(0, 26) || "BodyGate User";
}

function makeDnakeUserId(customerId: string) {
  const numbers = customerId.replace(/\D/g, "");
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
  const setCookie = res.headers.get("set-cookie");
  const sessionId = extractSessionId(setCookie);

  if (!res.ok || !sessionId) {
    throw new Error(
      `Login DNake fallito. Status=${res.status}. Response=${text}`
    );
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
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Supabase env mancanti" },
        { status: 500 }
      );
    }

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
      .select("id, first_name, last_name")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json(
        { ok: false, error: "Cliente non trovato", detail: customerError },
        { status: 404 }
      );
    }

    const sessionId = await dnakeLogin();

    const dnakeName = safeName(customer.first_name, customer.last_name);
    const dnakeUserId = makeDnakeUserId(customer.id);
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
          error: "Errore creazione utente DNake",
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
          error: "Errore generazione QR DNake",
          status: qrRes.status,
          response: qrText,
        },
        { status: 502 }
      );
    }

    const qrPayload = String(qrJson.qrcode);
    const now = new Date().toISOString();

    const { error: dnakeSaveError } = await supabaseAdmin
      .from("customer_dnake_users")
      .upsert(
        {
          customer_id: customerId,
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
          error: "Errore salvataggio customer_dnake_users",
          detail: dnakeSaveError,
        },
        { status: 500 }
      );
    }

    const { error: credentialError } = await supabaseAdmin
      .from("access_credentials")
      .upsert(
        {
          customer_id: customerId,
          type: "qr",
          code: qrPayload,
          controller_code: dnakeUserId,
          status: "active",
        },
        { onConflict: "code" }
      );

    if (credentialError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore salvataggio access_credentials",
          detail: credentialError,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("customer_timeline").insert({
      customer_id: customerId,
      type: "dnake_qr",
      title: "QR DNake generato",
      description: `QR DNake attivo per ${dnakeName} · User ID ${dnakeUserId}`,
      created_at: now,
    });

    return NextResponse.json({
      ok: true,
      customer_id: customerId,
      dnake_user_id: dnakeUserId,
      dnake_name: dnakeName,
      qrcode_timestamp: qrcodeTimestamp,
      qr_payload: qrPayload,
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
