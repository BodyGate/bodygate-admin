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
  maximum: number,
) {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0 ||
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

  const key = supplied || `course-room-${randomUUID()}`;

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
    message.includes("course_rooms_branch_name_key")
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "DUPLICATE_COURSE_ROOM",
        error: "Esiste già una sala con lo stesso nome.",
      },
      { status: 409 },
    );
  }

  if (message.includes("BODYGATE_VALIDATION_")) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_COURSE_ROOM",
        error: "Dati sala non validi.",
      },
      { status: 400 },
    );
  }

  if (
    code === "PGRST202" ||
    message.includes("create_course_room_atomic_v1")
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

  console.error("create_course_room_atomic_v1 error", error);

  return NextResponse.json(
    {
      ok: false,
      code: "COURSE_ROOM_CREATE_FAILED",
      error: "La sala non è stata creata.",
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
      .from("course_rooms")
      .select(`
        id,
        branch_id,
        name,
        description,
        capacity,
        is_active,
        created_at,
        updated_at
      `)
      .eq("branch_id", branch.id)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("course rooms list failed", error);

      return NextResponse.json(
        {
          ok: false,
          error: "Impossibile caricare le sale corsi.",
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
        course_rooms: data || [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    console.error("course rooms GET fatal", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento sale.",
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
    const description =
      String(body.description || "").trim() || null;
    const capacity = positiveInteger(body.capacity, 1000);

    if (!name || name.length > 120) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Il nome della sala è obbligatorio e non può superare 120 caratteri.",
        },
        { status: 400 },
      );
    }

    if (!capacity) {
      return NextResponse.json(
        {
          ok: false,
          error: "La capienza deve essere un numero maggiore di zero.",
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
      description,
      capacity,
    };

    const { data, error } = await db.rpc(
      "create_course_room_atomic_v1",
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

    if (!result.ok || !result.course_room_id || !result.course_room) {
      console.error("Invalid course room atomic response", result);

      return NextResponse.json(
        {
          ok: false,
          error: "Risposta creazione sala non valida.",
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
    console.error("course rooms POST fatal", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore creazione sala.",
      },
      { status: 500 },
    );
  }
}
