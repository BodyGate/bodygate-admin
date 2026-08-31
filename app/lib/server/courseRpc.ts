import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9:_-]{16,180}$/;

export function getCourseSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getIdempotencyKey(
  req: Request,
  body: Record<string, unknown>,
): string | null {
  const supplied = String(
    req.headers.get("idempotency-key") ||
      body.idempotency_key ||
      body.operation_id ||
      "",
  ).trim();

  const key = supplied || `server-${randomUUID()}`;

  return IDEMPOTENCY_KEY_RE.test(key) ? key : null;
}

export function courseRequestHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Maps BODYGATE_* exceptions raised by the course RPCs to an HTTP response.
 * Course RPC error codes are self-describing (BODYGATE_COURSE_SESSION_FULL,
 * BODYGATE_COURSE_BOOKING_ALREADY_PAID, ...) so this stays generic rather
 * than hand-mapping every one like the older membership-fee route does.
 */
export function courseRpcErrorResponse(error: {
  code?: string | null;
  message?: string | null;
}): NextResponse {
  const message = String(error.message || "");

  if (
    message.includes("BODYGATE_IDEMPOTENCY_PAYLOAD_MISMATCH") ||
    message.includes("BODYGATE_OPERATION_ALREADY_PROCESSING") ||
    message.includes("BODYGATE_IDEMPOTENCY_OPERATION_INCOMPLETE")
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "IDEMPOTENCY_CONFLICT",
        error:
          "La stessa operazione è già in corso o è stata inviata con dati differenti. Aggiorna la pagina prima di riprovare.",
      },
      { status: 409 },
    );
  }

  const notFoundMatch = message.match(/BODYGATE_[A-Z_]*_NOT_FOUND/);
  if (notFoundMatch) {
    return NextResponse.json(
      { ok: false, code: notFoundMatch[0], error: "Elemento non trovato." },
      { status: 404 },
    );
  }

  if (message.startsWith("BODYGATE_VALIDATION_")) {
    return NextResponse.json(
      { ok: false, code: message, error: "Dati non validi." },
      { status: 400 },
    );
  }

  const conflictCodes = [
    "BODYGATE_COURSE_ALREADY_BOOKED",
    "BODYGATE_COURSE_ENROLLMENT_ALREADY_ACTIVE",
    "BODYGATE_COURSE_ENROLLMENT_ALREADY_CANCELLED",
    "BODYGATE_COURSE_BOOKING_ALREADY_CANCELLED",
    "BODYGATE_COURSE_BOOKING_ALREADY_PAID",
    "BODYGATE_COURSE_SESSION_FULL",
    "BODYGATE_COURSE_ROOM_SCHEDULE_CONFLICT",
    "BODYGATE_COURSE_INSTRUCTOR_SCHEDULE_CONFLICT",
    "BODYGATE_COURSE_CAPACITY_EXCEEDS_ROOM",
  ];
  const conflictMatch = conflictCodes.find((code) => message.includes(code));
  if (conflictMatch) {
    return NextResponse.json(
      { ok: false, code: conflictMatch, error: "Operazione non consentita in questo stato." },
      { status: 409 },
    );
  }

  const forbiddenCodes = [
    "BODYGATE_CUSTOMER_NOT_ACTIVE",
    "BODYGATE_CUSTOMER_BRANCH_REQUIRED",
    "BODYGATE_CUSTOMER_BRANCH_MISMATCH",
    "BODYGATE_MEDICAL_CERTIFICATE_NOT_VALID",
    "BODYGATE_ACTIVE_SUBSCRIPTION_REQUIRED",
    "BODYGATE_COURSE_BOOKING_DISABLED",
    "BODYGATE_COURSE_BOOKING_NOT_OPEN",
    "BODYGATE_COURSE_BOOKING_CLOSED",
    "BODYGATE_COURSE_BOOKING_NOT_PAYABLE",
    "BODYGATE_COURSE_BOOKING_NOT_CANCELLABLE",
    "BODYGATE_COURSE_SCHEDULE_NOT_ACTIVE",
    "BODYGATE_COURSE_SESSION_NOT_BOOKABLE",
    "BODYGATE_COURSE_ENROLLMENT_NOT_ACTIVE",
    "BODYGATE_COURSE_ENROLLMENT_NOT_FIXED_PRICING",
    "BODYGATE_COURSE_TYPE_NOT_ACTIVE",
    "BODYGATE_COURSE_ROOM_NOT_ACTIVE",
    "BODYGATE_COURSE_INSTRUCTOR_NOT_ACTIVE",
    "BODYGATE_BRANCH_NOT_ACTIVE",
  ];
  const forbiddenMatch = forbiddenCodes.find((code) => message.includes(code));
  if (forbiddenMatch) {
    return NextResponse.json(
      { ok: false, code: forbiddenMatch, error: "Requisiti non soddisfatti per questa operazione." },
      { status: 422 },
    );
  }

  console.error("course RPC error", error);

  return NextResponse.json(
    { ok: false, code: "COURSE_OPERATION_FAILED", error: "Operazione corsi non riuscita." },
    { status: 500 },
  );
}

export function parseCourseRpcResult(data: unknown): Record<string, unknown> {
  return typeof data === "string"
    ? (JSON.parse(data) as Record<string, unknown>)
    : ((data || {}) as Record<string, unknown>);
}
