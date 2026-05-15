import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const documentId = body.documentId;
    const otp = body.otp;

    if (!documentId || !otp) {
      return NextResponse.json(
        {
          ok: false,
          message: "Dati mancanti.",
        },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: document, error } = await supabase
      .from("customer_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error || !document) {
      return NextResponse.json(
        {
          ok: false,
          message: "Documento non trovato.",
        },
        { status: 404 }
      );
    }

    if (document.otp_code !== otp) {
      return NextResponse.json(
        {
          ok: false,
          message: "OTP non valido.",
        },
        { status: 400 }
      );
    }

    if (
      document.otp_expires_at &&
      new Date(document.otp_expires_at) <
        new Date()
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "OTP scaduto.",
        },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for") ||
      "unknown";

    const userAgent =
      req.headers.get("user-agent") ||
      "unknown";

    const { error: updateError } = await supabase
      .from("customer_documents")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        signed_ip: ip,
        signed_user_agent: userAgent,
      })
      .eq("id", documentId);

    if (updateError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Errore firma documento.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Documento firmato correttamente.",
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