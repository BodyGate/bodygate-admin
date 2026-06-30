import { NextResponse } from "next/server";
import {
  getCurrentAuthContext,
  UnauthorizedError,
} from "../../../lib/server/auth";
import { SESSION_COOKIE_NAME } from "../../../lib/auth/session";

export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  const response = NextResponse.json(
    { ok: false, error: "Unauthorized" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("bodygate_role", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext();

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: context.user.id,
          email: context.user.email,
          role: context.user.role,
        },
        role_key: context.roleKey,
        staff_name: context.staffName,
        permissions: context.permissions,
        is_admin: context.isAdmin,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }

    console.error("Errore caricamento sessione corrente:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Errore caricamento sessione.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}