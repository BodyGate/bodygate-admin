import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const { error } = await supabase
      .from("customer_documents")
      .update({
        otp_code: otp,
        otp_expires_at: expiresAt,
        status: "pending_otp",
      })
      .eq("id", documentId);

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