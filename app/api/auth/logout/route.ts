import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "../../../lib/auth/session";

export async function POST() {
  const response = NextResponse.json({
    ok: true,
    message: "Logout effettuato.",
  });

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
