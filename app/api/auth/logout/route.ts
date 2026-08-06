import { NextResponse } from "next/server";
import { shouldUseSecureCookie } from "../../../lib/auth/cookie-security";
import { SESSION_COOKIE_NAME } from "../../../lib/auth/session";

export async function POST(req: Request) {
  const secureCookie = shouldUseSecureCookie(req);
  const response = NextResponse.json({
    ok: true,
    message: "Logout effettuato.",
  });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("bodygate_role", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: 0,
  });

  return response;
}
