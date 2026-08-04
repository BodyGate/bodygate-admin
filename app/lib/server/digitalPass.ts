import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizeNumericControllerCode } from "../accessCodeNormalizer";

const DNAKE_IP = process.env.DNAKE_IP || "192.168.1.22";
const DNAKE_USERNAME = process.env.DNAKE_USERNAME || "admin";
const DNAKE_PASSWORD_MD5 = process.env.DNAKE_PASSWORD_MD5 || "";

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type QrResult = {
  created: boolean;
  source: "customer_dnake_users" | "access_credentials" | "dnake";
  dnakeUserId: string;
  dnakeName: string;
  qrPayload: string;
  controllerCode: string;
  qrcodeTimestamp: string | null;
};

export class DigitalPassError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "DigitalPassError";
    this.statusCode = statusCode;
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new DigitalPassError("Configurazione Supabase server mancante.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function customerName(customer: Customer) {
  return `${customer.first_name || ""} ${customer.last_name || ""}`.trim().slice(0, 26) || "BodyGate User";
}

function makeDnakeUserId(customerId: string) {
  const digits = customerId.replace(/\D/g, "");
  return (digits || Date.now().toString()).slice(0, 6);
}

function activeCredential(row: any) {
  return row?.is_active === true || String(row?.status || "").toLowerCase() === "active";
}

function getSessionId(setCookie: string | null) {
  return setCookie?.match(/SessionID=([^;]+)/i)?.[1] || "";
}

function dnakeHeaders(sessionId: string) {
  return {
    Cookie: `SessionID=${sessionId}`,
    Accept: "application/json, text/plain, */*",
  };
}

async function loginDnake() {
  if (!DNAKE_PASSWORD_MD5) {
    throw new DigitalPassError("DNAKE_PASSWORD_MD5 mancante in .env.local", 503);
  }

  const url = `http://${DNAKE_IP}/cgi-bin/webapi.cgi?api=login&username=${encodeURIComponent(
    DNAKE_USERNAME,
  )}&password=${encodeURIComponent(DNAKE_PASSWORD_MD5)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json, text/plain, */*", pragma: "no-cache" },
    cache: "no-store",
  });
  const text = await response.text();
  const sessionId = getSessionId(response.headers.get("set-cookie"));

  if (!response.ok || !sessionId) {
    throw new DigitalPassError(
      `Login DNake fallito. HTTP ${response.status}: ${text}`,
      502,
    );
  }

  return sessionId;
}

async function assertLiveDnakeIdAvailable(sessionId: string, dnakeUserId: string) {
  const response = await fetch(`http://${DNAKE_IP}/data/users.xml`, {
    headers: dnakeHeaders(sessionId),
    cache: "no-store",
  });
  const text = await response.text();

  if (!response.ok || !text.trimStart().startsWith("<")) {
    throw new DigitalPassError(
      "Impossibile verificare in sicurezza gli utenti presenti sul DNake.",
      502,
    );
  }

  const escaped = dnakeUserId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(^|\\D)${escaped}(\\D|$)`, "m").test(text)) {
    throw new DigitalPassError(
      `L'ID DNake ${dnakeUserId} esiste già nel dispositivo. Operazione interrotta.`,
      409,
    );
  }
}

async function assertDatabaseIdAvailable(supabase: any, customerId: string, dnakeUserId: string) {
  const [dnakeResult, credentialResult] = await Promise.all([
    supabase
      .from("customer_dnake_users")
      .select("customer_id, dnake_user_id")
      .eq("dnake_user_id", dnakeUserId),
    supabase
      .from("access_credentials")
      .select("customer_id, code, controller_code")
      .or(`controller_code.eq.${dnakeUserId},code.eq.${dnakeUserId}`),
  ]);

  if (dnakeResult.error) {
    throw new DigitalPassError(`Errore controllo ID DNake: ${dnakeResult.error.message}`);
  }
  if (credentialResult.error) {
    throw new DigitalPassError(`Errore controllo credenziali: ${credentialResult.error.message}`);
  }

  if ((dnakeResult.data || []).some((row: any) => String(row.customer_id) !== customerId)) {
    throw new DigitalPassError(
      `L'ID DNake ${dnakeUserId} è già collegato a un altro cliente.`,
      409,
    );
  }

  if ((credentialResult.data || []).some((row: any) => String(row.customer_id) !== customerId)) {
    throw new DigitalPassError(
      `Il codice controller ${dnakeUserId} è già collegato a un'altra credenziale.`,
      409,
    );
  }
}

async function ensureQrCredential(
  supabase: any,
  customerId: string,
  qrPayload: string,
  controllerCode: string,
) {
  const { data, error } = await supabase
    .from("access_credentials")
    .select("id, customer_id")
    .eq("code", qrPayload)
    .limit(2);

  if (error) throw new DigitalPassError(`Errore controllo QR: ${error.message}`);

  const conflict = (data || []).find((row: any) => String(row.customer_id) !== customerId);
  if (conflict) {
    throw new DigitalPassError("Il QR DNake è già assegnato a un altro cliente.", 409);
  }

  const existing = (data || []).find((row: any) => String(row.customer_id) === customerId);
  const payload = {
    customer_id: customerId,
    type: "qr",
    code: qrPayload,
    controller_code: controllerCode,
    status: "active",
    is_active: true,
  };

  const result = existing
    ? await supabase.from("access_credentials").update(payload).eq("id", existing.id)
    : await supabase.from("access_credentials").insert(payload);

  if (result.error) {
    throw new DigitalPassError(`Errore salvataggio credenziale QR: ${result.error.message}`);
  }
}

async function findExistingQr(supabase: any, customer: Customer): Promise<QrResult | null> {
  const [dnakeResult, credentialResult] = await Promise.all([
    supabase
      .from("customer_dnake_users")
      .select("dnake_user_id, dnake_name, qrcode_timestamp, qr_payload, qr_status, updated_at")
      .eq("customer_id", customer.id)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("access_credentials")
      .select("id, code, controller_code, status, is_active, created_at")
      .eq("customer_id", customer.id)
      .eq("type", "qr")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (dnakeResult.error) {
    throw new DigitalPassError(`Errore lettura QR DNake: ${dnakeResult.error.message}`);
  }
  if (credentialResult.error) {
    throw new DigitalPassError(`Errore lettura credenziali QR: ${credentialResult.error.message}`);
  }

  const dnakeRow = (dnakeResult.data || []).find(
    (row: any) => String(row.qr_status).toLowerCase() === "active" && row.qr_payload,
  );
  const inactiveDnakeRow = (dnakeResult.data || []).find((row: any) => row.qr_payload);

  if (!dnakeRow && inactiveDnakeRow) {
    throw new DigitalPassError(
      "Esiste un QR DNake disattivato. Verifica amministrativa necessaria prima della riattivazione.",
      409,
    );
  }

  if (dnakeRow?.qr_payload) {
    const dnakeUserId = String(dnakeRow.dnake_user_id || "").trim();
    const controllerCode = normalizeNumericControllerCode(dnakeUserId) || dnakeUserId;
    if (!controllerCode) throw new DigitalPassError("QR DNake senza codice controller valido.");

    await ensureQrCredential(supabase, customer.id, dnakeRow.qr_payload, controllerCode);
    return {
      created: false,
      source: "customer_dnake_users",
      dnakeUserId,
      dnakeName: String(dnakeRow.dnake_name || customerName(customer)),
      qrPayload: String(dnakeRow.qr_payload),
      controllerCode,
      qrcodeTimestamp: dnakeRow.qrcode_timestamp ? String(dnakeRow.qrcode_timestamp) : null,
    };
  }

  const credential = (credentialResult.data || []).find(
    (row: any) => row.code && activeCredential(row),
  );
  const inactiveCredential = (credentialResult.data || []).find((row: any) => row.code);

  if (!credential && inactiveCredential) {
    throw new DigitalPassError(
      "Esiste una credenziale QR disattivata. Verifica amministrativa necessaria prima della riattivazione.",
      409,
    );
  }

  if (!credential?.code) return null;

  const controllerCode = String(credential.controller_code || "").trim();
  if (!controllerCode) {
    throw new DigitalPassError("Credenziale QR esistente senza controller_code DNake.");
  }

  return {
    created: false,
    source: "access_credentials",
    dnakeUserId: controllerCode,
    dnakeName: customerName(customer),
    qrPayload: String(credential.code),
    controllerCode,
    qrcodeTimestamp: null,
  };
}

async function createDnakeQr(supabase: any, customer: Customer): Promise<QrResult> {
  const dnakeName = customerName(customer);
  const dnakeUserId = makeDnakeUserId(customer.id);
  const controllerCode = normalizeNumericControllerCode(dnakeUserId) || dnakeUserId;

  await assertDatabaseIdAvailable(supabase, customer.id, dnakeUserId);
  const sessionId = await loginDnake();
  await assertLiveDnakeIdAvailable(sessionId, dnakeUserId);

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const form = new FormData();
  for (const [key, value] of Object.entries({
    pass_enable: "0",
    active_enable: "0",
    group: "-1",
    action: "1",
    id: dnakeUserId,
    name: dnakeName,
    room: "",
    relays: "0",
    status: "1",
    type: "0",
    cards: "",
    pin_code: "",
    gender: "2",
    qrcode_timestamp: timestamp,
    picture: "",
  })) {
    form.append(key, value);
  }

  const createResponse = await fetch(`http://${DNAKE_IP}/cgi-bin/webapi.cgi?api=user`, {
    method: "POST",
    headers: dnakeHeaders(sessionId),
    body: form,
    cache: "no-store",
  });
  const createText = await createResponse.text();
  if (!createResponse.ok) {
    throw new DigitalPassError(
      `Creazione utente DNake fallita. HTTP ${createResponse.status}: ${createText}`,
      502,
    );
  }

  const qrResponse = await fetch(
    `http://${DNAKE_IP}/cgi-bin/webapi.cgi?api=user_qrcode&qrcode=${encodeURIComponent(
      `${dnakeUserId}_${timestamp}`,
    )}`,
    { headers: dnakeHeaders(sessionId), cache: "no-store" },
  );
  const qrText = await qrResponse.text();
  let qrJson: any = null;
  try {
    qrJson = JSON.parse(qrText);
  } catch {
    qrJson = null;
  }

  if (!qrResponse.ok || !qrJson?.qrcode) {
    throw new DigitalPassError(
      `Utente DNake ${dnakeUserId} creato, ma generazione QR fallita: ${qrText}`,
      502,
    );
  }

  const qrPayload = String(qrJson.qrcode);
  const { error: dnakeSaveError } = await supabase.from("customer_dnake_users").upsert(
    {
      customer_id: customer.id,
      dnake_user_id: dnakeUserId,
      dnake_name: dnakeName,
      qrcode_timestamp: timestamp,
      qr_payload: qrPayload,
      qr_status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "dnake_user_id" },
  );

  if (dnakeSaveError) {
    throw new DigitalPassError(
      `QR creato sul DNake ma non salvato in BodyGate: ${dnakeSaveError.message}`,
    );
  }

  await ensureQrCredential(supabase, customer.id, qrPayload, controllerCode);
  return {
    created: true,
    source: "dnake",
    dnakeUserId,
    dnakeName,
    qrPayload,
    controllerCode,
    qrcodeTimestamp: timestamp,
  };
}

async function ensureMobilePass(supabase: any, customerId: string, appUrl: string) {
  const { data: existing, error: readError } = await supabase
    .from("customer_mobile_passes")
    .select("id, public_token, is_active, created_at")
    .eq("customer_id", customerId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) throw new DigitalPassError(`Errore lettura Mobile Pass: ${readError.message}`);

  let pass = existing;
  let created = false;
  if (!pass?.public_token) {
    const { data, error } = await supabase
      .from("customer_mobile_passes")
      .insert({
        customer_id: customerId,
        public_token: crypto.randomBytes(24).toString("hex"),
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select("id, public_token, is_active, created_at")
      .single();
    if (error || !data) {
      throw new DigitalPassError(`Errore creazione Mobile Pass: ${error?.message || "record mancante"}`);
    }
    pass = data;
    created = true;
  }

  const mobileUrl = `/mobile/${pass.public_token}`;
  return {
    created,
    id: String(pass.id),
    publicToken: String(pass.public_token),
    mobileUrl,
    passUrl: `${appUrl.replace(/\/$/, "")}${mobileUrl}`,
  };
}

export async function ensureDigitalPass(params: {
  customerId: string;
  appUrl: string;
  operatorName: string;
}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name")
    .eq("id", params.customerId)
    .maybeSingle();

  if (error || !data) {
    throw new DigitalPassError(`Cliente non trovato${error?.message ? `: ${error.message}` : ""}`, 404);
  }

  const customer = data as Customer;
  const qr = (await findExistingQr(supabase, customer)) || (await createDnakeQr(supabase, customer));
  const mobilePass = await ensureMobilePass(supabase, customer.id, params.appUrl);
  const changed = qr.created || mobilePass.created;

  if (changed) {
    await supabase.from("customer_timeline").insert({
      customer_id: customer.id,
      type: "digital_pass",
      title: "Pass digitale BodyGate attivato",
      description: `QR DNake: ${qr.created ? "creato" : "già presente"} · Mobile Pass: ${
        mobilePass.created ? "creato" : "già presente"
      } · Operatore: ${params.operatorName}`,
      created_at: new Date().toISOString(),
    });
  }

  return {
    customer_id: customer.id,
    customer_name: customerName(customer),
    status: "active",
    changed,
    dnake_user_id: qr.dnakeUserId,
    dnake_name: qr.dnakeName,
    qrcode_timestamp: qr.qrcodeTimestamp,
    qr_payload: qr.qrPayload,
    controller_code: qr.controllerCode,
    qr_created: qr.created,
    qr_source: qr.source,
    mobile_pass_created: mobilePass.created,
    public_token: mobilePass.publicToken,
    mobile_url: mobilePass.mobileUrl,
    pass_url: mobilePass.passUrl,
  };
}
