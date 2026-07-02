import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireCoursePermission } from "../../../lib/server/courseAccess";
import { getDefaultOperationalBranch } from "../../../lib/server/defaultBranch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeDate(
  value: string | null,
  fallback: string,
) {
  const date = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fallback;
  }

  const parsed = new Date(`${date}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? fallback : date;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function endOfDayIso(date: string) {
  return `${date}T23:59:59.999Z`;
}

type SessionRow = {
  id: string;
  branch_id: string;
  course_type_id: string;
  room_id: string;
  instructor_staff_user_id: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: string;
  notes: string | null;
  course_types:
    | {
        id: string;
        name: string;
        color: string;
      }
    | Array<{
        id: string;
        name: string;
        color: string;
      }>
    | null;
  course_rooms:
    | {
        id: string;
        name: string;
      }
    | Array<{
        id: string;
        name: string;
      }>
    | null;
  staff_users:
    | {
        id: string;
        full_name: string;
      }
    | Array<{
        id: string;
        full_name: string;
      }>
    | null;
};

function firstRelation<T>(
  relation: T | T[] | null,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] || null;
  }

  return relation;
}

export async function GET(req: Request) {
  const access = await requireCoursePermission("view_courses");

  if (!access.ok) {
    return access.response;
  }

  const db = admin();

  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        error: "Configurazione Supabase server mancante.",
      },
      { status: 500 },
    );
  }

  try {
    const url = new URL(req.url);
    const today = new Date();
    const defaultFrom = dateOnly(today);
    const future = new Date(today);
    future.setDate(future.getDate() + 30);
    const defaultTo = dateOnly(future);

    const dateFrom = normalizeDate(
      url.searchParams.get("date_from"),
      defaultFrom,
    );
    const dateTo = normalizeDate(
      url.searchParams.get("date_to"),
      defaultTo,
    );

    if (dateTo < dateFrom) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La data finale non può precedere la data iniziale.",
        },
        { status: 400 },
      );
    }

    const branch = await getDefaultOperationalBranch(db);

    if (!branch?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nessuna sede operativa attiva disponibile.",
        },
        { status: 404 },
      );
    }

    const [
      typesResult,
      roomsResult,
      schedulesResult,
      sessionsResult,
    ] = await Promise.all([
      db
        .from("course_types")
        .select("id, is_active", { count: "exact" })
        .eq("branch_id", branch.id),
      db
        .from("course_rooms")
        .select("id, is_active", { count: "exact" })
        .eq("branch_id", branch.id),
      db
        .from("course_schedules")
        .select("id, status", { count: "exact" })
        .eq("branch_id", branch.id),
      db
        .from("course_sessions")
        .select(`
          id,
          branch_id,
          course_type_id,
          room_id,
          instructor_staff_user_id,
          starts_at,
          ends_at,
          capacity,
          status,
          notes,
          course_types (
            id,
            name,
            color
          ),
          course_rooms (
            id,
            name
          ),
          staff_users (
            id,
            full_name
          )
        `)
        .eq("branch_id", branch.id)
        .gte("starts_at", `${dateFrom}T00:00:00.000Z`)
        .lte("starts_at", endOfDayIso(dateTo))
        .order("starts_at", { ascending: true })
        .limit(250),
    ]);

    const errors = [
      typesResult.error,
      roomsResult.error,
      schedulesResult.error,
      sessionsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("Courses overview query failed", errors);

      return NextResponse.json(
        {
          ok: false,
          error: "Impossibile caricare il calendario corsi.",
        },
        { status: 500 },
      );
    }

    const sessions =
      (sessionsResult.data || []) as unknown as SessionRow[];
    const sessionIds = sessions.map((session) => session.id);

    let bookingRows: Array<{
      session_id: string;
      status: string;
    }> = [];

    if (sessionIds.length > 0) {
      const { data, error } = await db
        .from("course_bookings")
        .select("session_id, status")
        .in("session_id", sessionIds);

      if (error) {
        console.error("Courses bookings overview failed", error);

        return NextResponse.json(
          {
            ok: false,
            error:
              "Impossibile caricare le prenotazioni delle lezioni.",
          },
          { status: 500 },
        );
      }

      bookingRows = data || [];
    }

    const bookingMap = new Map<
      string,
      {
        confirmed: number;
        waitlisted: number;
        attended: number;
        no_show: number;
      }
    >();

    for (const booking of bookingRows) {
      const current = bookingMap.get(booking.session_id) || {
        confirmed: 0,
        waitlisted: 0,
        attended: 0,
        no_show: 0,
      };

      if (booking.status === "confirmed") {
        current.confirmed += 1;
      }

      if (booking.status === "waitlisted") {
        current.waitlisted += 1;
      }

      if (booking.status === "attended") {
        current.attended += 1;
      }

      if (booking.status === "no_show") {
        current.no_show += 1;
      }

      bookingMap.set(booking.session_id, current);
    }

    const normalizedSessions = sessions.map((session) => {
      const courseType = firstRelation(session.course_types);
      const room = firstRelation(session.course_rooms);
      const instructor = firstRelation(session.staff_users);
      const bookings = bookingMap.get(session.id) || {
        confirmed: 0,
        waitlisted: 0,
        attended: 0,
        no_show: 0,
      };

      const occupied =
        bookings.confirmed + bookings.attended;

      return {
        id: session.id,
        starts_at: session.starts_at,
        ends_at: session.ends_at,
        capacity: Number(session.capacity || 0),
        status: session.status,
        notes: session.notes,
        course_type: courseType,
        room,
        instructor,
        bookings: {
          ...bookings,
          occupied,
          available: Math.max(
            Number(session.capacity || 0) - occupied,
            0,
          ),
        },
      };
    });

    const activeTypes = (typesResult.data || []).filter(
      (item) => item.is_active,
    ).length;
    const activeRooms = (roomsResult.data || []).filter(
      (item) => item.is_active,
    ).length;
    const activeSchedules = (
      schedulesResult.data || []
    ).filter((item) => item.status === "active").length;

    const openSessions = normalizedSessions.filter(
      (session) =>
        session.status === "open" ||
        session.status === "scheduled",
    ).length;

    const confirmedBookings = normalizedSessions.reduce(
      (total, session) =>
        total +
        session.bookings.confirmed +
        session.bookings.attended,
      0,
    );

    const waitlistedBookings = normalizedSessions.reduce(
      (total, session) =>
        total + session.bookings.waitlisted,
      0,
    );

    return NextResponse.json(
      {
        ok: true,
        generated_at: new Date().toISOString(),
        branch,
        filters: {
          date_from: dateFrom,
          date_to: dateTo,
        },
        permissions: {
          can_manage_courses:
            access.context.isAdmin ||
            access.context.permissions.includes("manage_courses"),
          can_manage_bookings:
            access.context.isAdmin ||
            access.context.permissions.includes(
              "manage_course_bookings",
            ),
        },
        kpis: {
          active_course_types: activeTypes,
          active_rooms: activeRooms,
          active_schedules: activeSchedules,
          open_sessions: openSessions,
          confirmed_bookings: confirmedBookings,
          waitlisted_bookings: waitlistedBookings,
        },
        sessions: normalizedSessions,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    console.error("Courses overview fatal error", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore imprevisto nel calendario corsi.",
      },
      { status: 500 },
    );
  }
}
