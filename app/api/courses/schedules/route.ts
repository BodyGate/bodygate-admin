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
    const courseTypeId = String(searchParams.get("course_type_id") || "").trim();

    let query = supabase
      .from("course_schedules")
      .select(
        `
        *,
        course_types ( id, name, color, default_price ),
        course_rooms ( id, name, capacity ),
        staff_users ( id, full_name )
      `,
      )
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true });

    if (branchId) query = query.eq("branch_id", branchId);
    if (courseTypeId) query = query.eq("course_type_id", courseTypeId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, course_schedules: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore caricamento orari corso.",
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
      course_type_id: body.course_type_id,
      room_id: body.room_id,
      instructor_staff_user_id: body.instructor_staff_user_id || null,
      weekday: body.weekday,
      start_time: body.start_time,
      duration_minutes: body.duration_minutes,
      capacity: body.capacity,
      valid_from: body.valid_from,
      valid_until: body.valid_until || null,
      generation_horizon_days: body.generation_horizon_days,
      status: body.status || "draft",
    };
    const hash = courseRequestHash(payload);

    const { data, error } = await db.rpc("create_course_schedule_atomic_v1", {
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
        error: error instanceof Error ? error.message : "Errore creazione orario corso.",
      },
      { status: 500 },
    );
  }
}
