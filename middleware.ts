import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",

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

export function middleware(request: NextRequest) {
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

  const session = request.cookies.get("bodygate_session")?.value;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};