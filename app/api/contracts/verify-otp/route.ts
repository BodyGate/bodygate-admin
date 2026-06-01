import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const documentId = body.documentId;
    const otp = body.otp;

    if (!documentId || !otp) {
      return NextResponse.json(
        { ok: false, message: "Dati mancanti." },
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
        { ok: false, message: "Documento non trovato." },
        { status: 404 }
      );
    }

    if (document.otp_code !== otp) {
      return NextResponse.json(
        { ok: false, message: "OTP non valido." },
        { status: 400 }
      );
    }

    if (document.otp_expires_at && new Date(document.otp_expires_at) < new Date()) {
      return NextResponse.json(
        { ok: false, message: "OTP scaduto." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const { error: updateError } = await supabase
      .from("customer_documents")
      .update({
        status: "signed",
        signed_at: now,
        signed_ip: ip,
        signed_user_agent: userAgent,
      })
      .eq("id", documentId);

    if (updateError) {
      return NextResponse.json(
        { ok: false, message: "Errore firma documento." },
        { status: 500 }
      );
    }

    const customerId = document.customer_id;

    if (!customerId) {
      return NextResponse.json({
        ok: true,
        message: "Documento firmato correttamente.",
        customer_id: null,
      });
    }

    const { data: customer } = await supabase
      .from("customers")
      .select(
        `
        id,
        payment_status,
        contract_status,
        medical_certificate_status,
        medical_certificate_end_date
      `
      )
      .eq("id", customerId)
      .maybeSingle();

    const { data: membershipFee } = await supabase
      .from("customer_membership_fees")
      .select("id, valid_until")
      .eq("customer_id", customerId)
      .gte("valid_until", today)
      .order("valid_until", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: subscription } = await supabase
      .from("customer_subscriptions")
      .select("id, ends_at")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .gte("ends_at", today)
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: credential } = await supabase
      .from("access_credentials")
      .select("id, type, status")
      .eq("customer_id", customerId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const { data: activeBlock } = await supabase
      .from("customer_blocks")
      .select("id")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .or(`ends_at.is.null,ends_at.gte.${today}`)
      .limit(1)
      .maybeSingle();

    const paymentOk = customer?.payment_status === "paid";
    const contractOk = true;
    const membershipOk = Boolean(membershipFee);
    const subscriptionOk = Boolean(subscription);
    const credentialOk = Boolean(credential);
    const noActiveBlock = !activeBlock;

    const canActivate =
      paymentOk &&
      contractOk &&
      membershipOk &&
      subscriptionOk &&
      credentialOk &&
      noActiveBlock;

    await supabase
      .from("customers")
      .update({
        contract_status: "signed",
        subscription_status: subscriptionOk ? "active" : "expired",
        subscription_expiry: subscription?.ends_at || null,
        access_activation_status: canActivate ? "active" : "pending",
        onboarding_status: canActivate ? "completed" : "access_pending",
        is_active: canActivate,
        active: canActivate,
        status: canActivate ? "active" : "onboarding",
      })
      .eq("id", customerId);

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "contract",
      title: "Contratto firmato OTP",
      description: canActivate
        ? "Contratto firmato. Requisiti verificati: cliente attivato automaticamente."
        : `Contratto firmato. Attivazione non completata: ${
            [
              !paymentOk ? "pagamento mancante" : "",
              !membershipOk ? "quota associativa mancante/scaduta" : "",
              !subscriptionOk ? "abbonamento mancante/scaduto" : "",
              !credentialOk ? "credenziale accesso mancante" : "",
              !noActiveBlock ? "blocco cliente attivo" : "",
            ]
              .filter(Boolean)
              .join(", ") || "verifica manuale richiesta"
          }.`,
      created_at: now,
    });

    return NextResponse.json({
      ok: true,
      message: canActivate
        ? "Documento firmato. Cliente attivato automaticamente."
        : "Documento firmato. Cliente non ancora attivabile.",
      customer_id: customerId,
      activated: canActivate,
      checks: {
        paymentOk,
        membershipOk,
        subscriptionOk,
        credentialOk,
        noActiveBlock,
      },
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