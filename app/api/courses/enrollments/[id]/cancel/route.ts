import { NextResponse } from "next/server";
import {
  courseRequestHash,
  courseRpcErrorResponse,
  getCourseSupabaseClient,
  getIdempotencyKey,
  parseCourseRpcResult,
} from "../../../../../lib/server/courseRpc";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const db = getCourseSupabaseClient();

  try {
    const { id: enrollmentId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const idempotencyKey = getIdempotencyKey(req, body);

    if (!idempotencyKey) {
      return NextResponse.json({ ok: false, error: "Chiave operazione non valida." }, { status: 400 });
    }

    const cancelFutureBookings = body.cancel_future_bookings !== false;

    const payload = {
      enrollment_id: enrollmentId,
      reason: body.reason || null,
      cancel_future_bookings: cancelFutureBookings,
    };
    const hash = courseRequestHash(payload);

    const { data, error } = await db.rpc("cancel_course_enrollment_atomic_v1", {
      p_idempotency_key: idempotencyKey,
      p_request_hash: hash,
      p_enrollment_id: enrollmentId,
      p_reason: body.reason || null,
      p_cancel_future_bookings: cancelFutureBookings,
    });

    if (error) return courseRpcErrorResponse(error);

    return NextResponse.json(parseCourseRpcResult(data));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore annullamento iscrizione.",
      },
      { status: 500 },
    );
  }
}
