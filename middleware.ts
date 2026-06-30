import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "./app/lib/auth/session";

const publicPaths = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",

  // Mobile Pass pubblico
  "/mobile",
  "/staff-mobile",
  "/api/staff-mobile/send",

  // API Mobile Pass
  "/api/customers/create-mobile-pass",
  "/api/mobile-pass/send",

  // API accesso tornello / bridge
  "/api/access/check",
  "/api/access/log",
  "/api/dnake",
  "/api/bridge/status",
];

function isPathMatch(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function clearLegacySession(response: NextResponse) {
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

function unauthorized(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return clearLegacySession(
      NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      )
    );
  }

  return clearLegacySession(
    NextResponse.redirect(new URL("/login", request.url))
  );
}

async function isActiveAppUser(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  const endpoint = new URL("/rest/v1/app_users", supabaseUrl);
  endpoint.searchParams.set("id", `eq.${userId}`);
  endpoint.searchParams.set("active", "eq.true");
  endpoint.searchParams.set("select", "id");
  endpoint.searchParams.set("limit", "1");

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) return false;

    const rows = (await response.json()) as Array<{ id: string }>;

    return rows.length === 1;
  } catch (error) {
    console.error("Verifica sessione BodyGate non disponibile:", error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath = publicPaths.some((path) =>
    isPathMatch(pathname, path)
  );

  const isStaticFile =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/site.webmanifest");

  if (isPublicPath || isStaticFile) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const claims = await verifySessionToken(token);

  if (!claims) {
    return unauthorized(request);
  }

  const activeUser = await isActiveAppUser(claims.userId);

  if (!activeUser) {
    return unauthorized(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};