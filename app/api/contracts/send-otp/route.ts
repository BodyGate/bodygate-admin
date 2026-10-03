import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resetRateLimit } from "../../../lib/server/rateLimit";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const documentId = body.documentId;

    if (!documentId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Documento mancante.",
        },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    ).toISOString();

    // A signed contract is a legal record: never move it back to
    // "pending_otp" (that would make verify-otp accept a fresh OTP and
    // overwrite signed_at / signed_ip / signed_user_agent). The status filter
    // is part of the update itself, so it also holds against a concurrent sign.
    const { data: updatedRows, error } = await supabase
      .from("customer_documents")
      .update({
        otp_code: otp,
        otp_expires_at: expiresAt,
        status: "pending_otp",
      })
      .eq("id", documentId)
      .or("status.is.null,status.neq.signed")
      .select("id");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: "Errore generazione OTP.",
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      const { data: existing } = await supabase
        .from("customer_documents")
        .select("status")
        .eq("id", documentId)
        .maybeSingle();

      return NextResponse.json(
        {
          ok: false,
          message: existing
            ? "Documento già firmato: non è possibile generare un nuovo OTP."
            : "Documento non trovato.",
        },
        { status: existing ? 409 : 404 }
      );
    }

    // A fresh OTP invalidates whatever the visitor was guessing against
    // before - without this, an operator who correctly regenerates a code
    // after a lockout stays locked out on verify-otp for the rest of that
    // 15-minute window, even entering the new, correct code.
    resetRateLimit(`verify-otp:${documentId}`);

    return NextResponse.json({
      ok: true,
      otp,
      expires_at: expiresAt,
      message: "OTP generato correttamente.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        message: "Errore server.",
        error: err?.message,
      },
      { status: 500 }
    );
  }
}