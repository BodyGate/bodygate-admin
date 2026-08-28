import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

function parseAmount(value: unknown) {
  const amount = Number(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(amount) || amount <= 0) return null;

  return Number(amount.toFixed(2));
}

function normalizeDate(value: unknown) {
  const date = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return null;

  return date;
}

function normalizePaymentMethod(value: unknown) {
  const method = String(value || "").trim().toLowerCase();

  if (method === "cash") return "cash";
  if (method === "pos") return "pos";
  if (method === "bank_transfer") return "bank_transfer";

  return null;
}

function getIdempotencyKey(
  req: Request,
  body: Record<string, unknown>,
) {
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
      {
        ok: false,
        code: "CUSTOMER_NOT_FOUND",
        error: "Cliente non trovato.",
      },
      { status: 404 },
    );
  }

  if (message.includes("BODYGATE_DUPLICATE_MEMBERSHIP_FEE")) {
    return NextResponse.json(
      {
        ok: false,
        code: "DUPLICATE_MEMBERSHIP_FEE",
        error:
          "Esiste già una quota associativa per lo stesso cliente e lo stesso periodo.",
      },
      { status: 409 },
    );
  }

  if (message.includes("BODYGATE_DUPLICATE_MEMBERSHIP_RECEIPT")) {
    return NextResponse.json(
      {
        ok: false,
        code: "DUPLICATE_MEMBERSHIP_RECEIPT",
        error:
          "Esiste già una ricevuta di quota associativa per lo stesso anno. Conferma esplicitamente per procedere.",
      },
      { status: 409 },
    );
  }

  if (message.includes("BODYGATE_VALIDATION_")) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_MEMBERSHIP_REQUEST",
        error:
          "Dati quota associativa non validi. Controlla importo, metodo di pagamento e periodo.",
      },
      { status: 400 },
    );
  }

  if (
    code === "PGRST202" ||
    message.includes("renew_membership_fee_atomic_v1")
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "ATOMIC_MEMBERSHIP_MIGRATION_REQUIRED",
        error:
          "Il rinnovo quota associativa atomico non è ancora attivo nel database. Applica la migration Atomic Operations 0.3.",
      },
      { status: 503 },
    );
  }

  console.error("renew_membership_fee_atomic_v1 error", error);

  return NextResponse.json(
    {
      ok: false,
      code: "ATOMIC_MEMBERSHIP_FAILED",
      error:
        "La quota associativa non è stata registrata. Nessun dato parziale deve essere considerato valido.",
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
    const amount = parseAmount(body.amount);
    const paymentMethod = normalizePaymentMethod(
      body.payment_method || body.paymentMethod,
    );
    const validFrom = normalizeDate(
      body.valid_from || body.validFrom,
    );
    const validUntil = normalizeDate(
      body.valid_until || body.validUntil,
    );
    const allowDuplicate = body.allow_duplicate === true;
    const idempotencyKey = getIdempotencyKey(req, body);

    if (!UUID_RE.test(customerId)) {
      return NextResponse.json(
        { ok: false, error: "customer_id non valido." },
        { status: 400 },
      );
    }

    if (!amount) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Importo quota associativa obbligatorio e maggiore di zero.",
        },
        { status: 400 },
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        {
          ok: false,
          error: "Metodo pagamento quota associativa non valido.",
        },
        { status: 400 },
      );
    }

    if (!validFrom || !validUntil) {
      return NextResponse.json(
        {
          ok: false,
          error: "Periodo quota associativa non valido.",
        },
        { status: 400 },
      );
    }

    if (validUntil < validFrom) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La data fine validità deve essere successiva o uguale alla data inizio.",
        },
        { status: 400 },
      );
    }

    if (!idempotencyKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Chiave operazione non valida.",
        },
        { status: 400 },
      );
    }

    const normalizedRequest = {
      customer_id: customerId,
      amount,
      payment_method: paymentMethod,
      valid_from: validFrom,
      valid_until: validUntil,
      allow_duplicate: allowDuplicate,
    };
    const hash = requestHash(normalizedRequest);

    const { data, error } = await db.rpc(
      "renew_membership_fee_atomic_v1",
      {
        p_idempotency_key: idempotencyKey,
        p_request_hash: hash,
        p_customer_id: customerId,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_valid_from: validFrom,
        p_valid_until: validUntil,
        p_allow_duplicate: allowDuplicate,
      },
    );

    if (error) {
      return rpcErrorResponse(error);
    }

    const result =
      typeof data === "string"
        ? (JSON.parse(data) as Record<string, unknown>)
        : ((data || {}) as Record<string, unknown>);

    if (
      !result.ok ||
      !result.membership_fee ||
      !result.customer_payment ||
      !result.payment ||
      !result.receipt ||
      !result.contract_document
    ) {
      console.error(
        "renew_membership_fee_atomic_v1 invalid payload",
        result,
      );

      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_ATOMIC_MEMBERSHIP_RESPONSE",
          error: "Risposta quota associativa non valida.",
        },
        { status: 500 },
      );
    }

    const receipt = result.receipt as {
      id?: string;
      receipt_number?: string;
    };
    const contractDocument = result.contract_document as {
      id?: string;
    };
    const customerPayment = result.customer_payment as {
      id?: string;
    };
    const payment = result.payment as { id?: string };
    const membershipFee = result.membership_fee as {
      id?: string;
    };

    const receiptUrl = receipt.id
      ? `/customers/${customerId}/receipt/${receipt.id}`
      : null;

    return NextResponse.json(
      {
        ...result,
        membership_fee: result.membership_fee,
        customer_payment_id: customerPayment.id || null,
        payment_id: payment.id || null,
        receipt,
        receipt_url: receiptUrl,
        print_url: receiptUrl ? `${receiptUrl}?print=1` : null,
        contract_document_id: contractDocument.id || null,
        contract_url: `/customers/${customerId}/contract`,
        contract_created: Boolean(contractDocument.id),
        contract_warning: null,
        membership_fee_id: membershipFee.id || null,
        cash_movement_created: false,
        accounting_entry_created: false,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    console.error("renew-membership-fee fatal error", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore imprevisto durante il rinnovo quota associativa.",
      },
      { status: 500 },
    );
  }
}