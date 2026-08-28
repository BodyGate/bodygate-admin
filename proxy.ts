import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { shouldUseSecureCookie } from "./app/lib/auth/cookie-security";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "./app/lib/auth/session";

const publicExactPaths = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/health",

  // API hardware pubbliche indispensabili. Le route amministrative che
  // condividono questi prefissi devono restare protette dalla sessione.
  "/api/access/check",
  "/api/access/log",
  "/api/dnake/event",
  "/api/bridge/status",
]);

const machineProtectedPaths = new Set([
  "/api/access/check",
  "/api/access/log",
]);

// /ui-lab/platinum is a self-contained design-preview lab: local demo data
// only (see architecture/platinum-screen-registry.ts dataMode:"local-demo"),
// no operational actions, no real customer/session data. AppShell already
// treats it as an isolated, unauthenticated area (isIsolatedUiLab) — this
// mirrors that here so the middleware doesn't redirect it to /login first.
const publicPagePrefixes = ["/mobile", "/staff-mobile", "/ui-lab/platinum"];

type MachineAuthMode = "off" | "observe" | "enforce";

function getMachineAuthMode(): MachineAuthMode {
  const value = process.env.BODYGATE_MACHINE_AUTH_MODE?.trim().toLowerCase();

  if (value === "observe" || value === "enforce") {
    return value;
  }

  return "off";
}

function getPresentedMachineKey(request: NextRequest) {
  const directKey = request.headers.get("x-bodygate-machine-key")?.trim();

  if (directKey) {
    return directKey;
  }

  const authorization = request.headers.get("authorization")?.trim();
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);

  return bearerMatch?.[1]?.trim() || null;
}

function checkMachineAuthentication(request: NextRequest) {
  const mode = getMachineAuthMode();

  if (mode === "off") {
    return null;
  }

  const configuredKey = process.env.BODYGATE_MACHINE_KEY?.trim();
  const presentedKey = getPresentedMachineKey(request);
  const authenticated =
    Boolean(configuredKey) &&
    Boolean(presentedKey) &&
    configuredKey === presentedKey;

  if (authenticated) {
    return null;
  }

  const reason = configuredKey
    ? "credenziale macchina assente o non valida"
    : "BODYGATE_MACHINE_KEY non configurata";

  console.warn("[BodyGate machine auth]", {
    mode,
    pathname: request.nextUrl.pathname,
    method: request.method,
    reason,
  });

  if (mode === "observe") {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      allowed: false,
      error: "Machine authentication required",
    },
    { status: configuredKey ? 401 : 503 }
  );
}

function isPublicPath(pathname: string) {
  if (publicExactPaths.has(pathname)) return true;

  return publicPagePrefixes.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function clearLegacySession(
  response: NextResponse,
  request: NextRequest
) {
  const secureCookie = shouldUseSecureCookie(request);

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

function unauthorized(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return clearLegacySession(
      NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      ),
      request
    );
  }

  return clearLegacySession(
    NextResponse.redirect(new URL("/login", request.url)),
    request
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (machineProtectedPaths.has(pathname)) {
    const machineAuthResponse = checkMachineAuthentication(request);

    if (machineAuthResponse) {
      return machineAuthResponse;
    }
  }

  const publicPath = isPublicPath(pathname);

  const isStaticFile =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/site.webmanifest");

  if (publicPath || isStaticFile) {
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
