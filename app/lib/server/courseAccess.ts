import { NextResponse } from "next/server";
import {
  getCurrentAuthContext,
  UnauthorizedError,
  type CurrentAuthContext,
} from "./auth";

export type CoursePermissionKey =
  | "view_courses"
  | "manage_courses"
  | "manage_course_bookings";

type CourseAccessSuccess = {
  ok: true;
  context: CurrentAuthContext;
};

type CourseAccessFailure = {
  ok: false;
  response: NextResponse;
};

export async function requireCoursePermission(
  permission: CoursePermissionKey,
): Promise<CourseAccessSuccess | CourseAccessFailure> {
  try {
    const context = await getCurrentAuthContext();

    if (
      !context.isAdmin &&
      !context.permissions.includes(permission)
    ) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            code: "COURSE_PERMISSION_REQUIRED",
            error: "Permesso insufficiente per il modulo corsi.",
            required_permission: permission,
          },
          { status: 403 },
        ),
      };
    }

    return {
      ok: true,
      context,
    };
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            code: "UNAUTHORIZED",
            error: "Sessione non valida o scaduta.",
          },
          { status: 401 },
        ),
      };
    }

    console.error("Course permission validation failed", error);

    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          code: "COURSE_AUTH_FAILED",
          error: "Impossibile verificare i permessi corsi.",
        },
        { status: 500 },
      ),
    };
  }
}
