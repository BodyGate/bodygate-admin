import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body.email;
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, message: "Email e password obbligatorie." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: user, error } = await supabase
      .from("app_users")
      .select("id, email, role, active, password")
      .eq("email", email)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, message: "Utente non trovato." },
        { status: 401 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { ok: false, message: "Utente disattivato." },
        { status: 403 }
      );
    }

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      return NextResponse.json(
        { ok: false, message: "Password non corretta." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      message: "Login effettuato.",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set("bodygate_session", user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    response.cookies.set("bodygate_role", user.role, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        message: "Errore server login.",
        error: err?.message,
      },
      { status: 500 }
    );
  }
}