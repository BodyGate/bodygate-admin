import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  credentialLookupCodes,
  normalizeRfidCode,
} from "../../../utils/rfid";
import { getDefaultOperationalBranch } from "../../../lib/server/defaultBranch";
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

type PlatinumPlan = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
};

type SubscriptionPlanRow = {
  id: string;
  name: string | null;
  price: number | null;
  promo_price: number | null;
  duration_days: number | null;
};

const OFFICIAL_SUBSCRIPTION_PLAN_NAMES = new Set([
  "Mensile",
  "Trimestrale",
  "Semestrale",
  "Annuale",
  "Annuale ridotto Lun Mer Ven",
  "Annuale ridotto Mar Gio Sab",
  "Mensile Ridotto Lunedi-Mercoledi-Venerdi",
  "Mensile Ridotto Martedi-Giovedi-Sabato",
  "Pilates",
]);

function admin() {
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isOfficialPlanName(name: unknown) {
  return OFFICIAL_SUBSCRIPTION_PLAN_NAMES.has(
    String(name || "").trim(),
  );
}

type AdminClient = NonNullable<ReturnType<typeof admin>>;

async function getActiveMembershipFee(
  db: AdminClient,
  branchId: string,
) {
  const { data, error } = await db
    .from("membership_fee_settings")
    .select("name, price, validity_days, is_active")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("membership fee lookup failed", error);
    return null;
  }

  if (!data) return null;

  const membershipFee = data as {
    name: string | null;
    price: number | null;
    validity_days: number | null;
  };

  return {
    name: membershipFee.name || "Quota associativa",
    price: Number(membershipFee.price || 0),
    validity_days: Number(membershipFee.validity_days || 365),
  };
}

async function getActiveSubscriptionPlans(
  db: AdminClient,
  branchId: string,
): Promise<PlatinumPlan[]> {
  const { data, error } = await db
    .from("subscription_plans")
    .select(
      "id, name, price, promo_price, duration_days, sort_order, is_active",
    )
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("duration_days", { ascending: true });

  if (error) {
    console.warn("subscription plans lookup failed", error);
    return [];
  }

  return ((data || []) as SubscriptionPlanRow[])
    .filter((plan) => isOfficialPlanName(plan.name))
    .map((plan) => ({
      id: plan.id,
      name: plan.name || "Abbonamento",
      price: Number(plan.promo_price || plan.price || 0),
      duration_days: Number(plan.duration_days || 0),
    }));
}

async function getPlatinumConfig(
  db: AdminClient,
) {
  const branch = await getDefaultOperationalBranch(db);

  if (!branch?.id) return null;

  const [membershipFee, plans] = await Promise.all([
    getActiveMembershipFee(db, branch.id),
    getActiveSubscriptionPlans(db, branch.id),
  ]);

  return {
    branch,
    membership_fee: membershipFee || {
      name: "Quota associativa",
      price: 10,
      validity_days: 365,
    },
    plans,
    badge_fee: getDefaultBadgeFee(),
  };
}

function normalizePaymentMethod(value: unknown) {
  const method = String(value || "cash").trim().toLowerCase();

  if (method === "cash") return "cash";
  if (method === "pos") return "pos";
  if (method === "bank_transfer") return "bank_transfer";

  return null;
}

function normalizeOptionalDate(value: unknown) {
  const date = String(value || "").trim();

  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const parsed = new Date(`${date}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : date;
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

  return IDEMPOTENCY_KEY_RE.test(key) ? key : null;
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
          "La stessa operazione è già stata inviata con dati differenti o non è ancora conclusa. Aggiorna la pagina prima di riprovare.",
      },
      { status: 409 },
    );
  }

  if (message.includes("BODYGATE_DUPLICATE_CUSTOMER_FISCAL_CODE")) {
    return NextResponse.json(
      {
        ok: false,
        code: "DUPLICATE_CUSTOMER",
        error:
          "Esiste già un cliente con lo stesso codice fiscale. Apri la scheda esistente invece di creare un duplicato.",
      },
      { status: 409 },
    );
  }
  const duplicateBadgeMessages: Record<string, string> = {
    BODYGATE_DUPLICATE_BADGE_CUSTOMER:
      "Badge già assegnato a un cliente attivo.",
    BODYGATE_DUPLICATE_BADGE_CREDENTIAL:
      "Badge già assegnato a una credenziale cliente attiva.",
    BODYGATE_DUPLICATE_BADGE_CUSTOMER_BADGE:
      "Badge già presente nell’archivio badge clienti.",
    BODYGATE_DUPLICATE_BADGE_STAFF:
      "Badge già assegnato a un membro dello staff.",
  };

  for (const [errorCode, errorMessage] of Object.entries(
    duplicateBadgeMessages,
  )) {
    if (message.includes(errorCode)) {
      return NextResponse.json(
        {
          ok: false,
          code: "DUPLICATE_BADGE",
          error: errorMessage,
        },
        { status: 409 },
      );
    }
  }

  if (message.includes("BODYGATE_NOT_FOUND_BRANCH")) {
    return NextResponse.json(
      {
        ok: false,
        code: "BRANCH_NOT_FOUND",
        error: "Sede operativa non trovata.",
      },
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

  if (message.includes("BODYGATE_VALIDATION_")) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_ONBOARDING_REQUEST",
        error:
          "Dati onboarding non validi. Controlla anagrafica, piano, pagamento e badge.",
      },
      { status: 400 },
    );
  }

  if (
    code === "PGRST202" ||
    message.includes("create_platinum_atomic_v1")
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "ATOMIC_ONBOARDING_MIGRATION_REQUIRED",
        error:
          "L’onboarding atomico non è ancora attivo nel database. Applica la migration Atomic Operations 0.4.",
      },
      { status: 503 },
    );
  }

  console.error("create_platinum_atomic_v1 error", error);

  return NextResponse.json(
    {
      ok: false,
      code: "ATOMIC_ONBOARDING_FAILED",
      error:
        "Il cliente non è stato creato. La transazione è stata annullata e nessun dato parziale deve essere considerato valido.",
    },
    { status: 500 },
  );
}

export async function GET() {
  const db = admin();

  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        error: "Configurazione Supabase server mancante.",
      },
      { status: 500 },
    );
  }

  try {
    const config = await getPlatinumConfig(db);

    if (!config) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Nessuna sede operativa attiva disponibile per l’onboarding.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, ...config },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore configurazione onboarding Platinum.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const db = admin();

  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        error: "Configurazione Supabase server mancante.",
      },
      { status: 500 },
    );
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const phone = String(body.phone || "").trim();
    const fiscalCode = String(body.fiscal_code || "")
      .trim()
      .toUpperCase();

    if (!firstName || !lastName) {
      return NextResponse.json(
        { ok: false, error: "Nome e cognome obbligatori." },
        { status: 400 },
      );
    }

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Telefono obbligatorio." },
        { status: 400 },
      );
    }

    if (!fiscalCode) {
      return NextResponse.json(
        { ok: false, error: "Codice fiscale obbligatorio." },
        { status: 400 },
      );
    }

    if (body.privacy_consent !== true) {
      return NextResponse.json(
        { ok: false, error: "Consenso privacy obbligatorio." },
        { status: 400 },
      );
    }

    const subscriptionChoice = String(
      body.subscription_choice ||
        body.subscription_mode ||
        "with_subscription",
    ).trim();

    if (
      subscriptionChoice !== "membership_only" &&
      subscriptionChoice !== "with_subscription"
    ) {
      return NextResponse.json(
        { ok: false, error: "Scelta abbonamento non valida." },
        { status: 400 },
      );
    }

    const paymentMethod = normalizePaymentMethod(
      body.payment_method || body.paymentMethod,
    );

    if (!paymentMethod) {
      return NextResponse.json(
        { ok: false, error: "Metodo pagamento non valido." },
        { status: 400 },
      );
    }

    const defaultBranch = await getDefaultOperationalBranch(db);
    const requestedBranchId = String(body.branch_id || "").trim();
    const branchId = UUID_RE.test(requestedBranchId)
      ? requestedBranchId
      : defaultBranch?.id || "";

    if (!UUID_RE.test(branchId)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Nessuna sede operativa attiva disponibile per completare l’onboarding.",
        },
        { status: 500 },
      );
    }

    const rawPlanId = String(
      body.subscription_plan_id || body.subscription_plan || "",
    ).trim();
    const subscriptionPlanId =
      subscriptionChoice === "with_subscription" &&
      UUID_RE.test(rawPlanId)
        ? rawPlanId
        : null;

    if (
      subscriptionChoice === "with_subscription" &&
      !subscriptionPlanId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Seleziona un piano abbonamento valido.",
        },
        { status: 400 },
      );
    }

    const badgeInput = String(
      body.badge_code || body.controller_code || "",
    ).trim();
    const normalizedBadge = normalizeRfidCode(badgeInput);

    if (badgeInput && !normalizedBadge) {
      return NextResponse.json(
        { ok: false, error: "Codice badge RFID non valido." },
        { status: 400 },
      );
    }

    const lookupCodes = normalizedBadge
      ? credentialLookupCodes(normalizedBadge.rawCode)
      : [];

    const badgeCode = normalizedBadge?.rawCode || "";
    const controllerCode =
      normalizedBadge?.controllerCode || lookupCodes[0] || "";

    const badgeChargeMode = normalizeBadgeChargeMode(
      body.badge_charge_mode,
    );
    const badgeComplimentaryReason = String(
      body.badge_complimentary_reason || "",
    ).trim();
    const badgeFeeConfig = getDefaultBadgeFee();

    if (
      badgeChargeMode === "charged" &&
      !badgeCode &&
      !controllerCode
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Per addebitare il Badge RFID serve un codice badge/controller valido.",
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

    const idempotencyKey = getIdempotencyKey(req, body);

    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Chiave operazione non valida." },
        { status: 400 },
      );
    }

    const normalizedRequest: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
      phone,
      email: String(body.email || "").trim().toLowerCase() || null,
      fiscal_code: fiscalCode,
      branch_id: branchId,
      gender: String(body.gender || "").trim() || null,
      birth_date: normalizeOptionalDate(body.birth_date),
      birth_place: String(body.birth_place || "").trim() || null,
      address: String(body.address || "").trim() || null,
      street_number:
        String(body.street_number || "").trim() || null,
      postal_code: String(body.postal_code || "").trim() || null,
      city: String(body.city || "").trim() || null,
      province: String(body.province || "").trim() || null,
      country: String(body.country || "Italia").trim() || "Italia",
      document_type:
        String(body.document_type || "").trim() || null,
      document_number:
        String(body.document_number || "").trim() || null,
      document_issued_by:
        String(body.document_issued_by || "").trim() || null,
      document_issued_at: normalizeOptionalDate(
        body.document_issued_at,
      ),
      document_expires_at: normalizeOptionalDate(
        body.document_expires_at,
      ),
      emergency_contact_name:
        String(body.emergency_contact_name || "").trim() || null,
      emergency_contact_phone:
        String(body.emergency_contact_phone || "").trim() || null,
      emergency_contact_relation:
        String(body.emergency_contact_relation || "").trim() || null,
      profession: String(body.profession || "").trim() || null,
      fitness_goal: String(body.fitness_goal || "").trim() || null,
      marketing_source:
        String(body.marketing_source || "").trim() || null,
      customer_tags: Array.isArray(body.customer_tags)
        ? body.customer_tags.map(String)
        : [],
      medical_certificate_start_date: normalizeOptionalDate(
        body.medical_certificate_start_date,
      ),
      medical_certificate_end_date: normalizeOptionalDate(
        body.medical_certificate_end_date,
      ),
      medical_certificate_url:
        String(body.medical_certificate_url || "").trim() || null,
      badge_code: badgeCode || null,
      controller_code: controllerCode || null,
      subscription_choice: subscriptionChoice,
      subscription_plan_id: subscriptionPlanId,
      payment_method: paymentMethod,
      membership_amount: Number(body.membership_amount || 10),
      badge_charge_mode: badgeChargeMode,
      badge_fee:
        badgeChargeMode === "charged" &&
        badgeFeeConfig.is_active
          ? Number(badgeFeeConfig.price || 0)
          : 0,
      badge_complimentary_reason:
        badgeComplimentaryReason || null,
      privacy_consent: true,
      marketing_consent: body.marketing_consent === true,
      photo_video_consent: body.photo_video_consent === true,
    };

    const hash = requestHash(normalizedRequest);

    const { data, error } = await db.rpc(
      "create_platinum_atomic_v1",
      {
        p_idempotency_key: idempotencyKey,
        p_request_hash: hash,
        p_payload: normalizedRequest,
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
      !result.customer_id ||
      !result.membership_fee ||
      !result.customer_payment ||
      !result.payment ||
      !result.receipt ||
      !result.contract_document
    ) {
      console.error(
        "create_platinum_atomic_v1 invalid payload",
        result,
      );

      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_ATOMIC_ONBOARDING_RESPONSE",
          error: "Risposta onboarding atomico non valida.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      result,
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    console.error("create-platinum fatal error", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore onboarding Platinum.",
      },
      { status: 500 },
    );
  }
}