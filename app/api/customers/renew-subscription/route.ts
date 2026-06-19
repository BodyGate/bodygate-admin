import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getDefaultBadgeFee,
  normalizeBadgeChargeMode,
} from "../../../lib/server/badgeFee";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9:_-]{16,180}$/;

function admin() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function normalizePaymentMethod(value: unknown) {
  const method = String(value || "cash").trim();

  if (method === "cash") return "cash";
  if (method === "pos") return "pos";
  if (method === "bank_transfer") return "bank_transfer";

  return null;
}

function normalizeDateOnly(value: unknown) {
  const date = String(value || "").trim().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return null;

  return date;
}

function parseOptionalAmount(value: unknown) {
  if (value === undefined || value === null || value === "") return null;

  const amount = Number(String(value).replace(",", "."));

  if (!Number.isFinite(amount) || amount <= 0) return null;

  return Number(amount.toFixed(2));
}

function getIdempotencyKey(req: Request, body: Record<string, unknown>) {
  const supplied = String(
    req.headers.get("idempotency-key") ||
      body.idempotency_key ||
      body.operation_id ||
      "",
  ).trim();

  const key = supplied || `server-${randomUUID()}`;

  if (!IDEMPOTENCY_KEY_RE.test(key)) {
    return null;
  }

  return key;
}

function requestHash(payload: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function rpcErrorResponse(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}) {
  const message = String(error.message || "");
  const code = String(error.code || "");

  if (
    message.includes("BODYGATE_IDEMPOTENCY_PAYLOAD_MISMATCH") ||
    message.includes("BODYGATE_IDEMPOTENCY_OPERATION_INCOMPLETE")
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "IDEMPOTENCY_CONFLICT",
        error:
          "La stessa operazione è già stata inviata con dati differenti o non è ancora conclusa. Aggiorna la scheda cliente prima di riprovare.",
      },
      { status: 409 },
    );
  }

  if (message.includes("BODYGATE_NOT_FOUND_CUSTOMER")) {
    return NextResponse.json(
      { ok: false, code: "CUSTOMER_NOT_FOUND", error: "Cliente non trovato." },
      { status: 404 },
    );
  }

  if (message.includes("BODYGATE_NOT_FOUND_PLAN")) {
    return NextResponse.json(
      {
        ok: false,
        code: "PLAN_NOT_FOUND",
        error: "Piano abbonamento non trovato.",
      },
      { status: 404 },
    );
  }

  if (message.includes("BODYGATE_VALIDATION_PLAN_NOT_ALLOWED")) {
    return NextResponse.json(
      {
        ok: false,
        code: "PLAN_NOT_ALLOWED",
        error: "Piano non ammesso per BodyGate.",
      },
      { status: 400 },
    );
  }

  if (message.includes("BODYGATE_VALIDATION_BRANCH_MISMATCH")) {
    return NextResponse.json(
      {
        ok: false,
        code: "BRANCH_MISMATCH",
        error: "Il piano selezionato appartiene a un'altra sede.",
      },
      { status: 400 },
    );
  }

  if (message.includes("BODYGATE_VALIDATION_BRANCH_REQUIRED")) {
    return NextResponse.json(
      {
        ok: false,
        code: "BRANCH_REQUIRED",
        error:
          "Sede operativa mancante. Correggi cliente o piano prima del rinnovo.",
      },
      { status: 400 },
    );
  }

  if (message.includes("BODYGATE_VALIDATION_BADGE_DELIVERY")) {
    return NextResponse.json(
      {
        ok: false,
        code: "BADGE_DELIVERY_REQUIRED",
        error:
          "Per addebitare il Badge RFID conferma la consegna di una nuova card.",
      },
      { status: 400 },
    );
  }

  if (message.includes("BODYGATE_VALIDATION_BADGE_REASON")) {
    return NextResponse.json(
      {
        ok: false,
        code: "BADGE_REASON_REQUIRED",
        error: "Per omaggiare il Badge RFID indica il motivo operatore.",
      },
      { status: 400 },
    );
  }

  if (message.includes("BODYGATE_VALIDATION_")) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_RENEWAL_REQUEST",
        error: "Dati rinnovo non validi. Controlla piano, importo e periodo.",
      },
      { status: 400 },
    );
  }

  if (code === "PGRST202" || message.includes("renew_subscription_atomic_v1")) {
    return NextResponse.json(
      {
        ok: false,
        code: "HOTFIX_0_2_MIGRATION_REQUIRED",
        error:
          "Il rinnovo sicuro non è ancora attivo nel database. Applica la migration HOTFIX 0.2 prima di usare questa funzione.",
      },
      { status: 503 },
    );
  }

  console.error("renew_subscription_atomic_v1 error", error);

  return NextResponse.json(
    {
      ok: false,
      code: "ATOMIC_RENEWAL_FAILED",
      error:
        "Il rinnovo non è stato registrato. Nessun dato parziale deve essere considerato valido.",
    },
    { status: 500 },
  );
}

export async function POST(req: Request) {
  const db = admin();

  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Configurazione Supabase mancante: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 },
    );
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const customerId = String(
      body.customer_id || body.customerId || "",
    ).trim();
    const planId = String(body.plan_id || body.planId || "").trim();
    const paymentMethod = normalizePaymentMethod(
      body.payment_method || body.paymentMethod,
    );
    const startDate = normalizeDateOnly(body.start_date || body.startDate);
    const requestedAmount = parseOptionalAmount(body.amount);
    const notes = String(body.notes || "").trim();
    const badgeChargeMode = normalizeBadgeChargeMode(body.badge_charge_mode);
    const badgeComplimentaryReason = String(
      body.badge_complimentary_reason || "",
    ).trim();
    const newBadgeDelivered = Boolean(
      body.new_badge_delivered ||
        body.badge_delivered ||
        body.badge_code ||
        body.controller_code,
    );
    const idempotencyKey = getIdempotencyKey(req, body);

    if (!UUID_RE.test(customerId)) {
      return NextResponse.json(
        { ok: false, error: "customer_id non valido." },
        { status: 400 },
      );
    }

    if (!UUID_RE.test(planId)) {
      return NextResponse.json(
        { ok: false, error: "plan_id non valido." },
        { status: 400 },
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { ok: false, error: "Metodo pagamento non valido." },
        { status: 400 },
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { ok: false, error: "Data inizio abbonamento non valida." },
        { status: 400 },
      );
    }

    if (
      body.amount !== undefined &&
      body.amount !== null &&
      body.amount !== "" &&
      requestedAmount === null
    ) {
      return NextResponse.json(
        { ok: false, error: "Importo rinnovo non valido." },
        { status: 400 },
      );
    }

    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Chiave operazione non valida." },
        { status: 400 },
      );
    }

    const badgeFeeConfig = getDefaultBadgeFee();
    const badgeFee =
      badgeChargeMode === "charged" && badgeFeeConfig.is_active
        ? Number(badgeFeeConfig.price || 0)
        : 0;

    if (badgeChargeMode === "charged" && !newBadgeDelivered) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Per addebitare il Badge RFID conferma la consegna di una nuova card.",
        },
        { status: 400 },
      );
    }

    if (
      badgeChargeMode === "complimentary" &&
      !badgeComplimentaryReason
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Per omaggiare il Badge RFID è obbligatorio indicare il motivo operatore.",
        },
        { status: 400 },
      );
    }

    const normalizedRequest = {
      customer_id: customerId,
      plan_id: planId,
      payment_method: paymentMethod,
      start_date: startDate,
      requested_amount: requestedAmount,
      notes,
      badge_charge_mode: badgeChargeMode,
      badge_fee: Number(badgeFee.toFixed(2)),
      badge_complimentary_reason: badgeComplimentaryReason,
      new_badge_delivered: newBadgeDelivered,
    };

    const hash = requestHash(normalizedRequest);

    const { data, error } = await db.rpc("renew_subscription_atomic_v1", {
      p_idempotency_key: idempotencyKey,
      p_request_hash: hash,
      p_customer_id: customerId,
      p_plan_id: planId,
      p_payment_method: paymentMethod,
      p_start_date: startDate,
      p_requested_amount: requestedAmount,
      p_notes: notes || null,
      p_badge_charge_mode: badgeChargeMode,
      p_badge_fee: Number(badgeFee.toFixed(2)),
      p_badge_complimentary_reason: badgeComplimentaryReason || null,
      p_new_badge_delivered: newBadgeDelivered,
    });

    if (error) {
      return rpcErrorResponse(error);
    }

    const result =
      typeof data === "string"
        ? (JSON.parse(data) as Record<string, unknown>)
        : ((data || {}) as Record<string, unknown>);

    if (!result.ok || !result.receipt) {
      console.error("renew_subscription_atomic_v1 invalid payload", result);

      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_ATOMIC_RENEWAL_RESPONSE",
          error: "Risposta rinnovo non valida.",
        },
        { status: 500 },
      );
    }

    const receipt = result.receipt as { id?: string };
    const receiptUrl =
      receipt?.id
        ? `/customers/${customerId}/receipt/${receipt.id}`
        : null;

    return NextResponse.json(
      {
        ...result,
        receipt_url: receiptUrl,
        print_url: receiptUrl ? `${receiptUrl}?print=1` : null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    console.error("renew-subscription fatal error", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore imprevisto durante il rinnovo.",
      },
      { status: 500 },
    );
  }
}
