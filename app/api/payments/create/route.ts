import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

function parseAmount(value: unknown) {
  const amount = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  if (amount <= 0) return null;
  return amount;
}

function normalizePaymentType(value: unknown) {
  return String(value || "").trim();
}

function normalizeDescription(value: unknown) {
  return String(value || "").trim();
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Configurazione Supabase mancante: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 },
      );
    }

    const body = await req.json();

    const customerId = body.customerId || body.customer_id || null;
    const paymentMethodId =
      body.paymentMethodId || body.payment_method_id || null;
    const paymentType = normalizePaymentType(
      body.paymentType || body.payment_type,
    );
    const amount = parseAmount(body.amount);
    const description = normalizeDescription(body.description);
    const now = new Date();
    const nowIso = now.toISOString();
    if (!paymentType) {
      return NextResponse.json(
        { ok: false, error: "Tipo pagamento mancante." },
        { status: 400 },
      );
    }

    if (!amount) {
      return NextResponse.json(
        { ok: false, error: "Importo non valido." },
        { status: 400 },
      );
    }

    /*
      Blocco di sicurezza BodyGate:
      Gli abbonamenti non devono più essere creati da /api/payments/create.
      Devono passare dal rinnovo guidato:
      /api/customers/renew-subscription

      Motivo:
      - data inizio modificabile
      - data fine calcolata correttamente
      - ricevuta
      - customer_subscriptions
      - customer_payments
      - payments
      - customer_receipts
      - timeline
    */
    if (paymentType === "subscription") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Gli abbonamenti devono essere registrati dal rinnovo guidato cliente, non da /api/payments/create.",
          redirect_to: "/api/customers/renew-subscription",
        },
        { status: 409 },
      );
    }

    /*
      Blocco di sicurezza BodyGate:
      Le quote associative non devono più essere create da /api/payments/create.
      Devono passare dal flusso guidato cliente:
      /api/customers/renew-membership-fee

      Motivo:
      - periodo validità controllato
      - customer_membership_fees ufficiale
      - customer_payments coerente
      - eventuale ricevuta generata solo dal flusso dedicato
      - timeline cliente
    */
    if (paymentType === "membership_fee") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Le quote associative devono essere registrate dal flusso guidato cliente, non da /api/payments/create.",
          redirect_to: "/api/customers/renew-membership-fee",
        },
        { status: 409 },
      );
    }

    const { data: customer, error: customerError } = customerId
      ? await supabase
          .from("customers")
          .select("id, first_name, last_name")
          .eq("id", customerId)
          .maybeSingle()
      : { data: null, error: null };

    if (customerError) {
      return NextResponse.json(
        { ok: false, error: customerError.message },
        { status: 500 },
      );
    }

    if (customerId && !customer) {
      return NextResponse.json(
        { ok: false, error: "Cliente non trovato." },
        { status: 404 },
      );
    }

    const { data: method, error: methodError } = paymentMethodId
      ? await supabase
          .from("payment_methods")
          .select("id, name, method_key")
          .eq("id", paymentMethodId)
          .maybeSingle()
      : { data: null, error: null };

    if (methodError) {
      return NextResponse.json(
        { ok: false, error: methodError.message },
        { status: 500 },
      );
    }

    const paymentMethodName = method?.method_key || method?.name || "cash";

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        customer_id: customerId,
        payment_method_id: paymentMethodId,
        amount,
        payment_type: paymentType,
        description: description || null,
        status: "paid",
        paid_at: nowIso,
        created_by: "admin@bodygate.it",
      })
      .select("id")
      .single();

    if (paymentError) {
      return NextResponse.json(
        { ok: false, error: paymentError.message },
        { status: 500 },
      );
    }

    const { data: customerPayment, error: customerPaymentError } =
      await supabase
        .from("customer_payments")
        .insert({
          customer_id: customerId,
          amount,
          type: paymentType,
          description: description || null,
          payment_method: paymentMethodName,
          status: "paid",
          paid_at: nowIso,
          notes: null,
        })
        .select("id")
        .single();

    if (customerPaymentError) {
      return NextResponse.json(
        { ok: false, error: customerPaymentError.message },
        { status: 500 },
      );
    }

    /*
      Importante:
      NON creiamo cash_movements qui.
      La prima nota / contabilità generale arriverà nel modulo contabile futuro.
    */

    if (customerId) {
      await supabase.from("customer_timeline").insert({
        customer_id: customerId,
        type: "payment",
        title: "Pagamento registrato",
        description:
          description ||
          `Pagamento ${paymentType} di €${amount.toFixed(2)} registrato.`,
      });
    }

    return NextResponse.json({
      ok: true,
      payment_id: payment.id,
      customer_payment_id: customerPayment.id,
      cash_movement_created: false,
      subscription_created: false,
      membership_fee_created: false,
      receipt_created: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Errore imprevisto durante la registrazione pagamento.",
      },
      { status: 500 },
    );
  }
}
