import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bridgeBaseUrl =
  process.env.BODYGATE_BRIDGE_URL ||
  process.env.NEXT_PUBLIC_BODYGATE_BRIDGE_URL ||
  "http://127.0.0.1:5050";

const CODE_KEYS = [
  "code",
  "card",
  "cardNo",
  "card_no",
  "number",
  "Number",
  "userId",
  "UserID",
];

const ESSENTIAL_HEADERS = [
  "host",
  "user-agent",
  "content-type",
  "content-length",
  "x-forwarded-for",
  "x-real-ip",
];

type DnakeBody = Record<string, unknown> | string | null;

type AccessResult = {
  ok?: boolean;
  allowed?: boolean;
  reason?: string;
  badge_code?: string;
  customer_id?: string;
  customer_name?: string;
  [key: string]: unknown;
};

type OpenResult = {
  attempted: boolean;
  ok: boolean;
  status?: number;
  message?: string;
  error?: string;
  bridge_url?: string;
};

type AccessLogResult = "allowed" | "denied" | "error";

type TechnicalLogResult = {
  attempted: boolean;
  ok: boolean;
  id?: string;
  error?: string;
};

function getTechnicalLogResult(accessResult: AccessResult): AccessLogResult {
  if (accessResult.allowed === true) {
    return "allowed";
  }

  if (
    typeof accessResult.http_status === "number" &&
    accessResult.http_status >= 500
  ) {
    return "error";
  }

  return "denied";
}

function getEssentialHeaders(req: Request) {
  return ESSENTIAL_HEADERS.reduce<Record<string, string | null>>(
    (headers, key) => {
      headers[key] = req.headers.get(key);
      return headers;
    },
    {},
  );
}

function getQueryParams(url: URL) {
  return Array.from(url.searchParams.entries()).reduce<Record<string, string>>(
    (params, [key, value]) => {
      params[key] = value;
      return params;
    },
    {},
  );
}

function firstNonEmpty(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

function findCodeInObject(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of CODE_KEYS) {
    const direct = firstNonEmpty(record[key]);
    if (direct) {
      return direct;
    }
  }

  for (const nestedValue of Object.values(record)) {
    const nested = findCodeInObject(nestedValue);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function findCodeInText(value: string): string | null {
  for (const key of CODE_KEYS) {
    const pattern = new RegExp(`${key}[\\s:=\"']+([A-Za-z0-9_-]+)`, "i");
    const match = value.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

async function parseBody(req: Request): Promise<DnakeBody> {
  if (req.method === "GET" || req.method === "HEAD") {
    return null;
  }

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await req.formData();
      return Array.from(formData.entries()).reduce<Record<string, string>>(
        (body, [key, value]) => {
          body[key] = typeof value === "string" ? value : value.name;
          return body;
        },
        {},
      );
    } catch {
      return null;
    }
  }

  const rawBody = await req.text();

  if (!rawBody.trim()) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return rawBody;
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    try {
      return Array.from(new URLSearchParams(rawBody).entries()).reduce<
        Record<string, string>
      >((body, [key, value]) => {
        body[key] = value;
        return body;
      }, {});
    } catch {
      return rawBody;
    }
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return rawBody;
  }
}

function extractCode(url: URL, body: DnakeBody): string | null {
  for (const key of CODE_KEYS) {
    const queryCode = firstNonEmpty(url.searchParams.get(key));
    if (queryCode) {
      return queryCode;
    }
  }

  if (typeof body === "string") {
    return findCodeInText(body);
  }

  return findCodeInObject(body);
}

async function checkAccess(req: Request, code: string): Promise<AccessResult> {
  const machineKey = process.env.BODYGATE_MACHINE_KEY?.trim();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (machineKey) {
    headers["x-bodygate-machine-key"] = machineKey;
  }

  const response = await fetch(new URL("/api/access/check", req.url), {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      badge: code,
      badge_code: code,
      source: "dnake",
    }),
  });

  const text = await response.text();
  let payload: AccessResult;

  try {
    payload = JSON.parse(text) as AccessResult;
  } catch {
    payload = {
      ok: false,
      allowed: false,
      reason: text || "Risposta access check non JSON",
    };
  }

  return {
    ...payload,
    http_status: response.status,
  };
}

async function openTurnstile(): Promise<OpenResult> {
  const normalizedBaseUrl = bridgeBaseUrl.replace(/\/+$/g, "");
  const bridgeUrl = `${normalizedBaseUrl}/open0`;

  try {
    const response = await fetch(bridgeUrl, {
      method: "GET",
      cache: "no-store",
    });

    const text = await response.text();

    return {
      attempted: true,
      ok: response.ok,
      status: response.status,
      bridge_url: bridgeUrl,
      message: text || "Comando open0 inviato al bridge",
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      bridge_url: bridgeUrl,
      error:
        error instanceof Error
          ? error.message
          : "Impossibile contattare il bridge locale",
    };
  }
}
async function saveTechnicalLog(params: {
  code: string;
  accessResult: AccessResult;
  openResult: OpenResult;
  controllerIp: string | null;
}): Promise<TechnicalLogResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      attempted: false,
      ok: false,
      error: "Supabase service credentials non configurate",
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase
      .from("access_logs")
      .insert({
        badge_code: params.code,
        controller_code: params.code,
        customer_id: params.accessResult.customer_id ?? null,
        allowed: params.accessResult.allowed === true,
        result: getTechnicalLogResult(params.accessResult),
        reason: params.accessResult.reason ?? null,
        door: 0,
        reader: 0,
        event_type: 0,
        open_command_sent: params.openResult.attempted,
        open_sdk_result: params.openResult.ok,
        open_warning:
          params.accessResult.allowed === true && params.openResult.ok !== true,
        controller_ip: params.controllerIp,
        bridge_version: "local-http-5050",
      })
      .select("id")
      .single();

    if (error) {
      return {
        attempted: true,
        ok: false,
        error: error.message,
      };
    }

    return {
      attempted: true,
      ok: true,
      id: data.id,
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : "Errore log tecnico",
    };
  }
}

async function handleDnakeEvent(req: Request) {
  const url = new URL(req.url);
  const query = getQueryParams(url);
  const body = await parseBody(req);
  const headers = getEssentialHeaders(req);
  const code = extractCode(url, body);

  console.log("DNake event received");
  console.log("method", req.method);
  console.log("query params", query);
  console.log("body", body);
  console.log("headers", headers);
  console.log("extracted code", code);

  if (!code) {
    const debug = {
      method: req.method,
      query,
      body,
      headers,
      acceptedKeys: CODE_KEYS,
    };

    console.log("access result", null);
    console.log("open result", null);

    return NextResponse.json({
      ok: false,
      allowed: false,
      reason: "Codice badge/card non trovato nell'evento DNake",
      debug,
    });
  }

  const accessResult = await checkAccess(req, code);
  console.log("access result", accessResult);

  const openResult =
    accessResult.allowed === true
      ? await openTurnstile()
      : {
          attempted: false,
          ok: false,
          message: "Apertura non eseguita: accesso non consentito",
        };
  console.log("open result", openResult);

  const logResult = await saveTechnicalLog({
    code,
    accessResult,
    openResult,
    controllerIp: headers["x-forwarded-for"] || headers["x-real-ip"] || null,
  });

  return NextResponse.json({
    ok: true,
    received: true,
    extracted_code: code,
    allowed: accessResult.allowed === true,
    access: accessResult,
    open: openResult,
    log: logResult,
  });
}

export async function GET(req: Request) {
  return handleDnakeEvent(req);
}

export async function POST(req: Request) {
  return handleDnakeEvent(req);
}
