import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const OFFICIAL_SUBSCRIPTION_PLAN_NAMES = new Set(["Mensile","Trimestrale","Semestrale","Annuale","Annuale ridotto Lun Mer Ven","Annuale ridotto Mar Gio Sab","Mensile Ridotto Lunedi-Mercoledi-Venerdi","Mensile Ridotto Martedi-Giovedi-Sabato","Pilates"]);
function isOfficialPlanName(name: unknown) { return OFFICIAL_SUBSCRIPTION_PLAN_NAMES.has(String(name || "").trim()); }

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string) {
  if (!value) return new Date();

  const normalized = value.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const date = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function parseAmount(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const amount = Number(String(value).replace(",", "."));

  if (!Number.isFinite(amount)) {
    return null;
  }

  return amount;
}

function normalizePaymentMethod(value: string) {
  const method = String(value || "cash").trim();

  if (method === "cash") return "cash";
  if (method === "pos") return "pos";
  if (method === "bank_transfer") return "bank_transfer";

  return "cash";
}

type ReceiptNumberPayload = {
  receipt_year: number;
  receipt_sequence: number;
  receipt_number: string;
};

function parseReceiptNumberPayload(data: unknown): ReceiptNumberPayload | null {
  const payload =
    typeof data === "string" ? (JSON.parse(data) as unknown) : data;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const receiptData = payload as Partial<ReceiptNumberPayload>;

  if (
    typeof receiptData.receipt_year !== "number" ||
    typeof receiptData.receipt_sequence !== "number" ||
    typeof receiptData.receipt_number !== "string" ||
    !receiptData.receipt_number
  ) {
    return null;
  }

  return {
    receipt_year: receiptData.receipt_year,
    receipt_sequence: receiptData.receipt_sequence,
    receipt_number: receiptData.receipt_number,
  };
}

async function getNextReceiptNumber(): Promise<ReceiptNumberPayload> {
  const { data, error } = await supabaseAdmin.rpc(
    "next_bodygate_receipt_number_v2",
  );

  if (error || !data) {
    console.error("next_bodygate_receipt_number_v2 error", error);
    throw new Error(
      "Impossibile generare numero ricevuta progressivo annuale.",
    );
  }

  try {
    const receiptNumber = parseReceiptNumberPayload(data);

    if (!receiptNumber) {
      throw new Error("Payload RPC non valido.");
    }

    return receiptNumber;
  } catch (error) {
    console.error("next_bodygate_receipt_number_v2 payload error", error);
    throw new Error(
      "Impossibile generare numero ricevuta progressivo annuale.",
    );
  }
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
        { status: 500 },
      );
    }

    const body = await req.json();

    const customerId = String(body.customer_id || body.customerId || "").trim();
    const planId = String(body.plan_id || body.planId || "").trim();
    const paymentMethod = normalizePaymentMethod(
      String(body.payment_method || body.paymentMethod || "cash"),
    );
    const notes = String(body.notes || "").trim();
    const requestedStartDate = String(
      body.start_date || body.startDate || "",
    ).trim();
    const requestedAmount = parseAmount(body.amount);

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id mancante" },
        { status: 400 },
      );
    }

    if (!planId) {
      return NextResponse.json(
        { ok: false, error: "plan_id mancante" },
        { status: 400 },
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
        { status: 404 },
      );
    }

    const { data: plan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select(
        "id, name, price, promo_price, duration_days, branch_id, is_active",
      )
      .eq("id", planId)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json(
        {
          ok: false,
          error: "Piano abbonamento non trovato",
          detail: planError,
        },
        { status: 404 },
      );
    }

    if (!isOfficialPlanName(plan.name)) {
      return NextResponse.json({ ok: false, error: "Piano non ammesso per BodyGate." }, { status: 400 });
    }

    if (customer.branch_id && plan.branch_id && customer.branch_id !== plan.branch_id) {
      return NextResponse.json({ ok: false, error: "Il piano selezionato appartiene a un’altra sede." }, { status: 400 });
    }

    if (plan.is_active === false) {
      return NextResponse.json(
        {
          ok: false,
          error: "Piano abbonamento non attivo",
        },
        { status: 400 },
      );
    }

    const standardAmount = Number(plan.promo_price || plan.price || 0);
    const amount =
      requestedAmount !== null && requestedAmount > 0
        ? requestedAmount
        : standardAmount;

    const durationDays = Number(plan.duration_days || 0);

    if (!amount || amount <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Importo rinnovo non valido",
        },
        { status: 400 },
      );
    }

    if (!durationDays || durationDays <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Durata piano non valida",
        },
        { status: 400 },
      );
    }

    const startDateObj = parseDateOnly(requestedStartDate);

    if (!startDateObj) {
      return NextResponse.json(
        {
          ok: false,
          error: "Data inizio abbonamento non valida",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const startsAt = dateOnly(startDateObj);
    const endsAt = dateOnly(addDays(startDateObj, durationDays));
    const branchId = customer.branch_id || plan.branch_id || null;
    const customerName =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim();

    const paymentDescription = `Rinnovo abbonamento ${plan.name} (${startsAt} - ${endsAt})`;

    const receiptNumber = await getNextReceiptNumber();

    const todayOnly = dateOnly(new Date());

    if (startsAt <= todayOnly) {
      await supabaseAdmin
        .from("customer_subscriptions")
        .update({ is_active: false })
        .eq("customer_id", customerId)
        .eq("is_active", true);
    } else {
      await supabaseAdmin
        .from("customer_subscriptions")
        .update({ is_active: false })
        .eq("customer_id", customerId)
        .eq("is_active", true)
        .gte("starts_at", startsAt);
    }

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
        notes: notes || `Rinnovo guidato ${plan.name}`,
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
        { status: 500 },
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
        { status: 500 },
      );
    }

    const { data: accountingPayment, error: accountingPaymentError } =
      await supabaseAdmin
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
          error:
            "Abbonamento creato, ma errore registrazione incasso contabile",
          detail: accountingPaymentError,
          subscription_id: subscription.id,
          customer_payment_id: payment.id,
        },
        { status: 500 },
      );
    }

    await supabaseAdmin.from("customer_timeline").insert({
      customer_id: customerId,
      type: "subscription",
      title: "Abbonamento rinnovato",
      description: `${plan.name} €${amount.toFixed(
        2,
      )} valido dal ${startsAt} al ${endsAt}`,
      created_at: now,
    });

    const { data: receipt, error: receiptError } = await supabaseAdmin
      .from("customer_receipts")
      .insert({
        customer_id: customerId,
        payment_id: payment.id,
        subscription_id: subscription.id,
        receipt_year: receiptNumber.receipt_year,
        receipt_sequence: receiptNumber.receipt_sequence,
        receipt_number: receiptNumber.receipt_number,
        receipt_type: "subscription",
        amount,
        description: `${paymentDescription}${
          customerName ? ` - ${customerName}` : ""
        }`,
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
        { status: 500 },
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
  } catch (error: unknown) {
    console.error("renew-subscription fatal error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      },
      { status: 500 },
    );
  }
}
