import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
    const { id: scheduleId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const idempotencyKey = getIdempotencyKey(req, body);

    if (!idempotencyKey) {
      return NextResponse.json({ ok: false, error: "Chiave operazione non valida." }, { status: 400 });
    }

    const payload = {
      schedule_id: scheduleId,
      date_from: body.date_from,
      date_to: body.date_to,
    };
    const hash = courseRequestHash(payload);

    const { data, error } = await db.rpc("generate_course_sessions_atomic_v1", {
      p_idempotency_key: idempotencyKey,
      p_request_hash: hash,
      p_schedule_id: scheduleId,
      p_date_from: body.date_from,
      p_date_to: body.date_to,
    });

    if (error) return courseRpcErrorResponse(error);

    const generationResult = parseCourseRpcResult(data);

    // New sessions may need to inherit bookings from customers already
    // enrolled on this schedule. Best-effort: a sync failure here must not
    // fail session generation, which already succeeded and was recorded.
    let syncResult: Record<string, unknown> | null = null;
    try {
      const syncKey = `${idempotencyKey}-sync-${randomUUID()}`;
      const syncPayload = { schedule_id: scheduleId };
      const { data: syncData, error: syncError } = await db.rpc(
        "sync_enrollment_bookings_atomic_v1",
        {
          p_idempotency_key: syncKey,
          p_request_hash: courseRequestHash(syncPayload),
          p_schedule_id: scheduleId,
        },
      );

      if (!syncError) syncResult = parseCourseRpcResult(syncData);
      else console.error("sync_enrollment_bookings_atomic_v1 failed after generation", syncError);
    } catch (syncCatchError) {
      console.error("sync_enrollment_bookings_atomic_v1 threw after generation", syncCatchError);
    }

    return NextResponse.json({ ...generationResult, enrollment_sync: syncResult });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore generazione sessioni corso.",
      },
      { status: 500 },
    );
  }
}
