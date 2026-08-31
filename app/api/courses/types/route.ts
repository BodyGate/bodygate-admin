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
    const branchId = String(searchParams.get("branch_id") || "").trim();

    let query = supabase
      .from("course_types")
      .select("*")
      .order("name", { ascending: true });

    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, course_types: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore caricamento tipi corso.",
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

    const payload = {
      branch_id: body.branch_id,
      name: body.name,
      slug: body.slug,
      description: body.description,
      default_duration_minutes: body.default_duration_minutes,
      default_capacity: body.default_capacity,
      color: body.color,
      requires_medical_certificate: body.requires_medical_certificate,
      requires_active_subscription: body.requires_active_subscription,
      booking_enabled: body.booking_enabled,
      waitlist_enabled: body.waitlist_enabled,
      cancellation_cutoff_minutes: body.cancellation_cutoff_minutes,
      default_price: body.default_price,
    };
    const hash = courseRequestHash(payload);

    const { data, error } = await db.rpc("create_course_type_atomic_v1", {
      p_idempotency_key: idempotencyKey,
      p_request_hash: hash,
      p_payload: payload,
    });

    if (error) return courseRpcErrorResponse(error);

    return NextResponse.json(parseCourseRpcResult(data));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore creazione tipo corso.",
      },
      { status: 500 },
    );
  }
}
