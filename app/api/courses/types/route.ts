import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireCoursePermission } from "../../../lib/server/courseAccess";
import { getDefaultOperationalBranch } from "../../../lib/server/defaultBranch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9:_-]{16,180}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

function admin() {
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function positiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
) {
  const parsed = Number(value ?? fallback);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0 ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

function nonNegativeInteger(
  value: unknown,
  fallback: number,
  maximum: number,
) {
  const parsed = Number(value ?? fallback);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
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

  const key = supplied || `course-type-${randomUUID()}`;

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
    message.includes("BODYGATE_OPERATION_ALREADY_PROCESSING")
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "IDEMPOTENCY_CONFLICT",
        error:
          "La stessa operazione è già stata inviata con dati differenti o risulta ancora in elaborazione.",
      },
      { status: 409 },
    );
  }

  if (message.includes("BODYGATE_BRANCH_NOT_ACTIVE")) {
    return NextResponse.json(
      {
        ok: false,
        code: "BRANCH_NOT_ACTIVE",
        error: "La sede operativa non è attiva.",
      },
      { status: 409 },
    );
  }

  if (
    code === "23505" ||
    message.includes("course_types_branch_name_key") ||
    message.includes("course_types_branch_slug_key")
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "DUPLICATE_COURSE_TYPE",
        error:
          "Esiste già una tipologia corso con lo stesso nome o identificativo.",
      },
      { status: 409 },
    );
  }

  if (message.includes("BODYGATE_VALIDATION_")) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_COURSE_TYPE",
        error: "Dati tipologia corso non validi.",
      },
      { status: 400 },
    );
  }

  if (
    code === "PGRST202" ||
    message.includes("create_course_type_atomic_v1")
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "COURSES_CORE_REQUIRED",
        error:
          "Il core atomico corsi non risulta disponibile nel database.",
      },
      { status: 503 },
    );
  }

  console.error("create_course_type_atomic_v1 error", error);

  return NextResponse.json(
    {
      ok: false,
      code: "COURSE_TYPE_CREATE_FAILED",
      error: "La tipologia corso non è stata creata.",
    },
    { status: 500 },
  );
}

export async function GET() {
  const access = await requireCoursePermission("view_courses");

  if (!access.ok) return access.response;

  const db = admin();

  if (!db) {
    return NextResponse.json(
      { ok: false, error: "Configurazione Supabase mancante." },
      { status: 500 },
    );
  }

  try {
    const branch = await getDefaultOperationalBranch(db);

    if (!branch?.id) {
      return NextResponse.json(
        { ok: false, error: "Sede operativa non trovata." },
        { status: 404 },
      );
    }

    const { data, error } = await db
      .from("course_types")
      .select(`
        id,
        branch_id,
        name,
        slug,
        description,
        default_duration_minutes,
        default_capacity,
        color,
        requires_medical_certificate,
        requires_active_subscription,
        booking_enabled,
        waitlist_enabled,
        cancellation_cutoff_minutes,
        is_active,
        created_at,
        updated_at
      `)
      .eq("branch_id", branch.id)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("course types list failed", error);

      return NextResponse.json(
        {
          ok: false,
          error: "Impossibile caricare le tipologie corso.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        branch,
        permissions: {
          can_manage:
            access.context.isAdmin ||
            access.context.permissions.includes("manage_courses"),
        },
        course_types: data || [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    console.error("course types GET fatal", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento tipologie corso.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const access = await requireCoursePermission("manage_courses");

  if (!access.ok) return access.response;

  const db = admin();

  if (!db) {
    return NextResponse.json(
      { ok: false, error: "Configurazione Supabase mancante." },
      { status: 500 },
    );
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const branch = await getDefaultOperationalBranch(db);

    if (!branch?.id) {
      return NextResponse.json(
        { ok: false, error: "Sede operativa non trovata." },
        { status: 404 },
      );
    }

    const name = String(body.name || "").trim();
    const slug = String(body.slug || "")
      .trim()
      .toLowerCase();
    const description =
      String(body.description || "").trim() || null;
    const color = String(body.color || "#dc2626")
      .trim()
      .toLowerCase();

    const duration = positiveInteger(
      body.default_duration_minutes,
      50,
      1440,
    );
    const capacity = positiveInteger(
      body.default_capacity,
      1,
      1000,
    );
    const cutoff = nonNegativeInteger(
      body.cancellation_cutoff_minutes,
      120,
      10080,
    );

    if (!name || name.length > 120) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Il nome della tipologia è obbligatorio e non può superare 120 caratteri.",
        },
        { status: 400 },
      );
    }

    if (!SLUG_RE.test(slug)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Identificativo non valido. Usa lettere minuscole, numeri e trattini.",
        },
        { status: 400 },
      );
    }

    if (!COLOR_RE.test(color)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Colore non valido.",
        },
        { status: 400 },
      );
    }

    if (!duration || !capacity || cutoff === null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Durata, capienza o limite cancellazione non validi.",
        },
        { status: 400 },
      );
    }

    const idempotencyKey = getIdempotencyKey(req, body);

    if (!idempotencyKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Chiave operazione non valida.",
        },
        { status: 400 },
      );
    }

    const payload = {
      branch_id: branch.id,
      name,
      slug,
      description,
      default_duration_minutes: duration,
      default_capacity: capacity,
      color,
      requires_medical_certificate:
        body.requires_medical_certificate !== false,
      requires_active_subscription:
        body.requires_active_subscription === true,
      booking_enabled: body.booking_enabled !== false,
      waitlist_enabled: body.waitlist_enabled !== false,
      cancellation_cutoff_minutes: cutoff,
    };

    const { data, error } = await db.rpc(
      "create_course_type_atomic_v1",
      {
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash(payload),
        p_payload: payload,
      },
    );

    if (error) return rpcErrorResponse(error);

    const result =
      typeof data === "string"
        ? (JSON.parse(data) as Record<string, unknown>)
        : ((data || {}) as Record<string, unknown>);

    if (!result.ok || !result.course_type_id || !result.course_type) {
      console.error("Invalid course type atomic response", result);

      return NextResponse.json(
        {
          ok: false,
          error: "Risposta creazione tipologia non valida.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(result, {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("course types POST fatal", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore creazione tipologia corso.",
      },
      { status: 500 },
    );
  }
}
