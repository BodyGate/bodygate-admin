import { NextResponse } from "next/server";
import { getCourseSupabaseClient } from "../../../lib/server/courseRpc";

export const dynamic = "force-dynamic";

type CourseBookingSummary = { id: string; status: string };
type CourseSessionRow = Record<string, unknown> & {
  course_bookings?: CourseBookingSummary[] | null;
};

export async function GET(req: Request) {
  try {
    const supabase = getCourseSupabaseClient();
    const { searchParams } = new URL(req.url);
    const branchId = String(searchParams.get("branch_id") || "").trim();
    const from = String(searchParams.get("from") || "").trim();
    const to = String(searchParams.get("to") || "").trim();

    let query = supabase
      .from("course_sessions")
      .select(
        `
        *,
        course_types ( id, name, color, default_price ),
        course_rooms ( id, name ),
        staff_users ( id, full_name ),
        course_bookings ( id, status )
      `,
      )
      .order("starts_at", { ascending: true });

    if (branchId) query = query.eq("branch_id", branchId);
    if (from) query = query.gte("starts_at", from);
    if (to) query = query.lte("starts_at", to);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const sessions = ((data || []) as CourseSessionRow[]).map((session) => {
      const bookings = Array.isArray(session.course_bookings) ? session.course_bookings : [];
      const confirmed = bookings.filter((b) => b.status === "confirmed" || b.status === "attended").length;
      const waitlisted = bookings.filter((b) => b.status === "waitlisted").length;

      const { course_bookings: _courseBookings, ...rest } = session;
      return { ...rest, confirmed_count: confirmed, waitlisted_count: waitlisted };
    });

    return NextResponse.json({ ok: true, course_sessions: sessions });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore caricamento sessioni corso.",
      },
      { status: 500 },
    );
  }
}
