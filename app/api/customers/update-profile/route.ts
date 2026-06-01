import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const paymentId = String(body.payment_id || "").trim();
    const customerId = String(body.customer_id || "").trim();
    const correctionReason = String(body.correction_reason || "").trim();

    if (!paymentId || !customerId) {
      return NextResponse.json(
        { ok: false, error: "payment_id e customer_id sono obbligatori" },
        { status: 400 }
      );
    }

    if (!correctionReason) {
      return NextResponse.json(
        { ok: false, error: "Motivo rettifica obbligatorio" },
        { status: 400 }
      );
    }

    const amount = Number(body.amount || 0);
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Importo non valido" },
        { status: 400 }
      );
    }

    const { data: currentPayment, error: currentError } = await supabaseAdmin
      .from("customer_payments")
      .select("*")
      .eq("id", paymentId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (currentError || !currentPayment) {
      return NextResponse.json(
        {
          ok: false,
          error: "Pagamento non trovato",
          detail: currentError,
        },
        { status: 404 }
      );
    }

    if (currentPayment.status === "cancelled") {
      return NextResponse.json(
        { ok: false, error: "Pagamento già annullato, non modificabile" },
        { status: 400 }
      );
    }

    const payload = {
      amount,
      payment_method: String(body.payment_method || "cash").trim(),
      description: String(body.description || "").trim() || null,
      paid_at: body.paid_at || currentPayment.paid_at || new Date().toISOString(),
      status: String(body.status || "paid").trim(),
      correction_reason: correctionReason,
      updated_at: new Date().toISOString(),
    };

    const { data: payment, error: updateError } = await supabaseAdmin
      .from("customer_payments")
      .update(payload)
      .eq("id", paymentId)
      .eq("customer_id", customerId)
      .select("*")
      .single();

    if (updateError || !payment) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore aggiornamento pagamento",
          detail: updateError,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("customer_timeline").insert({
      customer_id: customerId,
      type: "payment",
      title: "Pagamento rettificato",
      description: `Pagamento modificato. Motivo: ${correctionReason}`,
    });

    return NextResponse.json({
      ok: true,
      payment,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore sconosciuto",
      },
      { status: 500 }
    );
  }
}
