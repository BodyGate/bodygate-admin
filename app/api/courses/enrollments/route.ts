import { NextResponse } from "next/server";
import {
  courseRequestHash,
  courseRpcErrorResponse,
  getCourseSupabaseClient,
  getIdempotencyKey,
  parseCourseRpcResult,
} from "../../../lib/server/courseRpc";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = getCourseSupabaseClient();
    const { searchParams } = new URL(req.url);
    const scheduleId = String(searchParams.get("schedule_id") || "").trim();
    const customerId = String(searchParams.get("customer_id") || "").trim();

    if (!scheduleId && !customerId) {
      return NextResponse.json(
        { ok: false, error: "schedule_id o customer_id obbligatorio." },
        { status: 400 },
      );
    }

    let query = supabase
      .from("course_enrollments")
      .select(
        `
        *,
        customers ( id, first_name, last_name, phone ),
        course_schedules ( id, weekday, start_time, course_type_id, course_types ( id, name, color ) )
      `,
      )
      .order("enrolled_at", { ascending: true });

    if (scheduleId) query = query.eq("schedule_id", scheduleId);
    if (customerId) query = query.eq("customer_id", customerId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, course_enrollments: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore caricamento iscrizioni.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const db = getCourseSupabaseClient();

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const idempotencyKey = getIdempotencyKey(req, body);

    if (!idempotencyKey) {
      return NextResponse.json({ ok: false, error: "Chiave operazione non valida." }, { status: 400 });
    }

    const scheduleId = String(body.schedule_id || "").trim();
    const customerId = String(body.customer_id || "").trim();
    const pricingMode = String(body.pricing_mode || "").trim();
    const fixedPrice = body.fixed_price != null ? Number(body.fixed_price) : null;
    const paymentMethod = body.payment_method ? String(body.payment_method).trim() : null;
    const billingCycle = String(body.billing_cycle || "monthly").trim();

    const payload = {
      schedule_id: scheduleId,
      customer_id: customerId,
      pricing_mode: pricingMode,
      fixed_price: fixedPrice,
      payment_method: paymentMethod,
      billing_cycle: billingCycle,
    };
    const hash = courseRequestHash(payload);

    const { data, error } = await db.rpc("enroll_customer_course_atomic_v1", {
      p_idempotency_key: idempotencyKey,
      p_request_hash: hash,
      p_schedule_id: scheduleId,
      p_customer_id: customerId,
      p_pricing_mode: pricingMode,
      p_fixed_price: fixedPrice,
      p_payment_method: paymentMethod,
      p_billing_cycle: billingCycle,
    });

    if (error) return courseRpcErrorResponse(error);

    return NextResponse.json(parseCourseRpcResult(data));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore iscrizione corso.",
      },
      { status: 500 },
    );
  }
}
