import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { shouldUseSecureCookie } from "../../../lib/auth/cookie-security";
import {
  checkLoginThrottle,
  clearLoginFailures,
  clientIpFromHeaders,
  normalizeKey,
  recordLoginFailure,
  throttleMessage,
} from "../../../lib/auth/loginThrottle";
import { createLoginAttemptStore } from "../../../lib/server/loginAttemptStore";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../../../lib/auth/session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
    };
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, message: "Email e password obbligatorie." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Configurazione Supabase server mancante.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Limite ai tentativi: prima di toccare utenti e password.
    const attemptStore = createLoginAttemptStore(supabase);
    const throttleKey = normalizeKey(email, clientIpFromHeaders((name) => req.headers.get(name)));
    const throttle = await checkLoginThrottle(attemptStore, throttleKey);

    if (!throttle.allowed) {
      return NextResponse.json(
        { ok: false, message: throttleMessage(throttle.retryAfterSeconds) },
        {
          status: 429,
          headers: {
            "Retry-After": String(throttle.retryAfterSeconds),
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const { data: user, error } = await supabase
      .from("app_users")
      .select("id, email, role, active, password")
      .eq("email", email)
      .maybeSingle();

    if (error || !user || !user.active) {
      await recordLoginFailure(attemptStore, throttleKey);
      return NextResponse.json(
        { ok: false, message: "Credenziali non valide." },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      await recordLoginFailure(attemptStore, throttleKey);
      return NextResponse.json(
        { ok: false, message: "Credenziali non valide." },
        { status: 401 }
      );
    }

    await clearLoginFailures(attemptStore, throttleKey);

    const sessionToken = await createSessionToken(
      user.id,
      user.role || "staff"
    );
    const secureCookie = shouldUseSecureCookie(req);

    const response = NextResponse.json({
      ok: true,
      message: "Login effettuato.",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    response.cookies.set("bodygate_role", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error: unknown) {
    console.error("Errore server login:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Errore server login.",
      },
      { status: 500 }
    );
  }
}
