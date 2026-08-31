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
    const sessionId = String(searchParams.get("session_id") || "").trim();
    const customerId = String(searchParams.get("customer_id") || "").trim();

    if (!sessionId && !customerId) {
      return NextResponse.json(
        { ok: false, error: "session_id o customer_id obbligatorio." },
        { status: 400 },
      );
    }

    let query = supabase
      .from("course_bookings")
      .select(
        `
        *,
        customers ( id, first_name, last_name, phone ),
        course_sessions ( id, starts_at, ends_at, course_type_id, course_types ( id, name, color ) )
      `,
      )
      .order("booked_at", { ascending: true });

    if (sessionId) query = query.eq("session_id", sessionId);
    if (customerId) query = query.eq("customer_id", customerId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, course_bookings: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore caricamento prenotazioni.",
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

    const sessionId = String(body.session_id || "").trim();
    const customerId = String(body.customer_id || "").trim();
    const bookingSource = String(body.booking_source || "reception").trim();

    const payload = { session_id: sessionId, customer_id: customerId, booking_source: bookingSource };
    const hash = courseRequestHash(payload);

    const { data, error } = await db.rpc("book_course_session_atomic_v1", {
      p_idempotency_key: idempotencyKey,
      p_request_hash: hash,
      p_session_id: sessionId,
      p_customer_id: customerId,
      p_booking_source: bookingSource,
    });

    if (error) return courseRpcErrorResponse(error);

    return NextResponse.json(parseCourseRpcResult(data));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore prenotazione corso.",
      },
      { status: 500 },
    );
  }
}
