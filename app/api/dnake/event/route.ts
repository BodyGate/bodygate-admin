import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  createBadgeDeduper,
  DNAKE_EVENT_KEY_PARAM,
  isValidDnakeEventKey,
  redactSensitive,
} from "../../../lib/server/dnakeEventSecurity";
import { getClientIp, isRateLimited } from "../../../lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bridgeBaseUrl =
  process.env.BODYGATE_BRIDGE_URL ||
  process.env.NEXT_PUBLIC_BODYGATE_BRIDGE_URL ||
  "http://127.0.0.1:5050";

// Il lettore puo' ritrasmettere lo stesso evento: stesso badge entro 3 s = un solo passaggio.
const isDuplicateBadge = createBadgeDeduper(3000);

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

function isAuthorized(req: Request, url: URL) {
  if (isValidDnakeEventKey(
    url.searchParams.get(DNAKE_EVENT_KEY_PARAM),
    process.env.BODYGATE_DNAKE_EVENT_KEY,
  )) {
    return true;
  }

  // Chiamate interne (bridge/cloud) con la chiave macchina.
  return isValidDnakeEventKey(
    req.headers.get("x-bodygate-machine-key"),
    process.env.BODYGATE_MACHINE_KEY,
  );
}

async function handleDnakeEvent(req: Request) {
  // Questo endpoint puo' aprire il tornello fisico: va autenticato (chiave
  // dedicata nell'URL o chiave macchina), non solo limitato in frequenza.
  // Fail-closed: senza BODYGATE_DNAKE_EVENT_KEY configurata nessun URL e' valido.
  const url = new URL(req.url);

  if (!isAuthorized(req, url)) {
    // I tentativi non autenticati hanno un limite basso per IP.
    if (
      isRateLimited(`dnake-event-denied:${getClientIp(req)}`, {
        limit: 20,
        windowMs: 60_000,
      })
    ) {
      return NextResponse.json(
        { ok: false, allowed: false, reason: "Troppe richieste" },
        { status: 429 },
      );
    }

    console.warn("DNake event rifiutato: chiave assente o non valida");
    return NextResponse.json(
      { ok: false, allowed: false, reason: "Non autorizzato" },
      { status: 401 },
    );
  }

  // Limite sul traffico autenticato: protegge da cicli anomali del lettore.
  if (
    isRateLimited("dnake-event:authenticated", { limit: 240, windowMs: 60_000 })
  ) {
    return NextResponse.json(
      { ok: false, allowed: false, reason: "Troppe richieste" },
      { status: 429 },
    );
  }

  const query = redactSensitive(getQueryParams(url));
  const body = await parseBody(req);
  const headers = redactSensitive(getEssentialHeaders(req));
  const code = extractCode(url, body);

  console.log("DNake event", {
    method: req.method,
    query,
    body: redactSensitive(body),
    code,
  });

  if (!code) {
    return NextResponse.json({
      ok: false,
      allowed: false,
      reason: "Codice badge/card non trovato nell'evento DNake",
      debug: {
        method: req.method,
        query,
        body: redactSensitive(body),
        headers,
        acceptedKeys: CODE_KEYS,
      },
    });
  }

  if (isDuplicateBadge(code)) {
    return NextResponse.json({
      ok: true,
      received: true,
      duplicate: true,
      extracted_code: code,
      allowed: false,
      reason: "Evento duplicato ignorato",
    });
  }

  const accessResult = await checkAccess(req, code);

  const openResult =
    accessResult.allowed === true
      ? await openTurnstile()
      : {
          attempted: false,
          ok: false,
          message: "Apertura non eseguita: accesso non consentito",
        };

  // Il log tecnico non deve ritardare la risposta al lettore ne' l'apertura:
  // l'apertura e' gia' avvenuta, il salvataggio prosegue in coda.
  void saveTechnicalLog({
    code,
    accessResult,
    openResult,
    controllerIp: headers["x-forwarded-for"] || headers["x-real-ip"] || null,
  }).then((result) => {
    if (!result.ok) {
      console.warn("DNake event: log tecnico non salvato", result.error);
    }
  });

  return NextResponse.json({
    ok: true,
    received: true,
    extracted_code: code,
    allowed: accessResult.allowed === true,
    access: accessResult,
    open: openResult,
    log: { attempted: true, pending: true },
  });
}

export async function GET(req: Request) {
  return handleDnakeEvent(req);
}

export async function POST(req: Request) {
  return handleDnakeEvent(req);
}
