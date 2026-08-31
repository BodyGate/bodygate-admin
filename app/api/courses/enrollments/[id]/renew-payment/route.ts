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
    const body = (await req.json()) as Record<string, unknown>;
    const idempotencyKey = getIdempotencyKey(req, body);

    if (!idempotencyKey) {
      return NextResponse.json({ ok: false, error: "Chiave operazione non valida." }, { status: 400 });
    }

    const amount = Number(body.amount);
    const paymentMethod = String(body.payment_method || "").trim();
    const periodLabel = String(body.period_label || "").trim();

    const payload = {
      enrollment_id: enrollmentId,
      amount,
      payment_method: paymentMethod,
      period_label: periodLabel,
    };
    const hash = courseRequestHash(payload);

    const { data, error } = await db.rpc("renew_course_enrollment_payment_atomic_v1", {
      p_idempotency_key: idempotencyKey,
      p_request_hash: hash,
      p_enrollment_id: enrollmentId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_period_label: periodLabel,
    });

    if (error) return courseRpcErrorResponse(error);

    return NextResponse.json(parseCourseRpcResult(data));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore rinnovo pagamento iscrizione.",
      },
      { status: 500 },
    );
  }
}
