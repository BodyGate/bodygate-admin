import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fallbackReceiptNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const stamp = `${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

  return `${year}/${stamp}`;
}

async function getNextReceiptNumber() {
  const { data, error } = await supabaseAdmin.rpc(
    "next_bodygate_receipt_number"
  );

  if (error || !data) {
    console.error("next_bodygate_receipt_number error", error);
    return fallbackReceiptNumber();
  }

  return String(data);
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Variabili Supabase mancanti. Controlla NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const customerId = String(body.customer_id || body.customerId || "").trim();
    const planId = String(body.plan_id || body.planId || "").trim();
    const paymentMethod = String(body.payment_method || body.paymentMethod || "cash").trim();
    const notes = String(body.notes || "").trim();

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id mancante" },
        { status: 400 }
      );
    }

    if (!planId) {
      return NextResponse.json(
        { ok: false, error: "plan_id mancante" },
        { status: 400 }
      );
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("id, first_name, last_name, branch_id")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cliente non trovato",
          detail: customerError,
        },
        { status: 404 }
      );
    }

    const { data: plan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, name, price, promo_price, duration_days, branch_id, is_active")
      .eq("id", planId)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json(
        {
          ok: false,
          error: "Piano abbonamento non trovato",
          detail: planError,
        },
        { status: 404 }
      );
    }

    if (plan.is_active === false) {
      return NextResponse.json(
        {
          ok: false,
          error: "Piano abbonamento non attivo",
        },
        { status: 400 }
      );
    }

    const amount = Number(plan.promo_price || plan.price || 0);
    const durationDays = Number(plan.duration_days || 0);

    if (!amount || amount <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Prezzo piano non valido",
        },
        { status: 400 }
      );
    }

    if (!durationDays || durationDays <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Durata piano non valida",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const today = new Date();
    const startsAt = dateOnly(today);
    const endsAt = dateOnly(addDays(today, durationDays));
    const branchId = customer.branch_id || plan.branch_id || null;
    const customerName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
    const paymentDescription = `Rinnovo abbonamento ${plan.name} (${startsAt} - ${endsAt})`;

    await supabaseAdmin
      .from("customer_subscriptions")
      .update({ is_active: false })
      .eq("customer_id", customerId)
      .eq("is_active", true);

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from("customer_subscriptions")
      .insert({
        customer_id: customerId,
        branch_id: branchId,
        plan_id: plan.id,
        amount,
        starts_at: startsAt,
        ends_at: endsAt,
        is_active: true,
        payment_method: paymentMethod,
        notes: notes || `Rinnovo automatico ${plan.name}`,
      })
      .select("*")
      .single();

    if (subscriptionError || !subscription) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore creazione abbonamento",
          detail: subscriptionError,
        },
        { status: 500 }
      );
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("customer_payments")
      .insert({
        customer_id: customerId,
        type: "subscription",
        description: paymentDescription,
        amount,
        payment_method: paymentMethod,
        status: "paid",
        paid_at: now,
      })
      .select("*")
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore registrazione pagamento abbonamento",
          detail: paymentError,
          subscription_id: subscription.id,
        },
        { status: 500 }
      );
    }

    const { data: accountingPayment, error: accountingPaymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        customer_id: customerId,
        payment_method_id: null,
        amount,
        payment_type: "subscription",
        description: paymentDescription,
        status: "paid",
        paid_at: now,
        created_by: "admin@bodygate.it",
      })
      .select("*")
      .single();

    if (accountingPaymentError || !accountingPayment) {
      return NextResponse.json(
        {
          ok: false,
          error: "Abbonamento creato, ma errore registrazione incasso contabile",
          detail: accountingPaymentError,
          subscription_id: subscription.id,
          customer_payment_id: payment.id,
        },
        { status: 500 }
      );
    }

    const { error: cashMovementError } = await supabaseAdmin
      .from("cash_movements")
      .insert({
        movement_type: "income",
        amount,
        category: "subscription",
        description: paymentDescription,
        payment_id: accountingPayment.id,
        created_by: "admin@bodygate.it",
        movement_at: now,
      });

    if (cashMovementError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Abbonamento e pagamento creati, ma errore movimento cassa",
          detail: cashMovementError,
          subscription_id: subscription.id,
          customer_payment_id: payment.id,
          payment_id: accountingPayment.id,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("customer_timeline").insert({
      customer_id: customerId,
      type: "subscription",
      title: "Abbonamento rinnovato",
      description: `${plan.name} €${amount.toFixed(2)} valido fino al ${endsAt}`,
      created_at: now,
    });

    const receiptNumber = await getNextReceiptNumber();

    const { data: receipt, error: receiptError } = await supabaseAdmin
      .from("customer_receipts")
      .insert({
        customer_id: customerId,
        payment_id: payment.id,
        subscription_id: subscription.id,
        receipt_number: receiptNumber,
        receipt_type: "subscription",
        amount,
        description: `${paymentDescription}${customerName ? ` - ${customerName}` : ""}`,
        customer_copy_label: "COPIA CLIENTE",
        gym_copy_label: "COPIA PALESTRA",
        issued_at: now,
      })
      .select("*")
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        {
          ok: false,
          error: "Abbonamento e pagamento creati, ma errore creazione ricevuta",
          detail: receiptError,
          subscription_id: subscription.id,
          payment_id: payment.id,
          accounting_payment_id: accountingPayment.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      customer_id: customerId,
      customer_name: customerName,
      plan: {
        id: plan.id,
        name: plan.name,
        duration_days: durationDays,
      },
      subscription,
      payment,
      accounting_payment: accountingPayment,
      receipt,
      receipt_url: `/customers/${customerId}/receipt/${receipt.id}`,
      print_url: `/customers/${customerId}/receipt/${receipt.id}?print=1`,
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
