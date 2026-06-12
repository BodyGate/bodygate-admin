import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OFFICIAL_SUBSCRIPTION_PLAN_NAMES = new Set([
  "Mensile",
  "Trimestrale",
  "Semestrale",
  "Annuale",
  "Annuale ridotto Lun Mer Ven",
  "Annuale ridotto Mar Gio Sab",
  "Mensile Ridotto Lunedi-Mercoledi-Venerdi",
  "Mensile Ridotto Martedi-Giovedi-Sabato",
  "Pilates",
]);

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey);
}

function dateOnly(value: string) {
  return String(value || "").slice(0, 10);
}

function isValidDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseAmount(value: unknown) {
  if (value === undefined || value === null || value === "") return null;

  const amount = Number(String(value).replace(",", "."));

  if (!Number.isFinite(amount)) return null;

  return amount;
}

function normalizePaymentMethod(value: string) {
  const method = String(value || "cash").trim();

  if (method === "cash") return "cash";
  if (method === "pos") return "pos";
  if (method === "bank_transfer") return "bank_transfer";

  return "cash";
}

function appendNote(previousNotes: string | null, newNote: string) {
  const current = String(previousNotes || "").trim();

  if (!current) return newNote;

  return `${current}\n\n${newNote}`;
}

function planDescription(planName: string, startsAt: string, endsAt: string) {
  return `Rinnovo abbonamento ${planName} (${startsAt} - ${endsAt})`;
}

function isOfficialPlanName(name: string) {
  return OFFICIAL_SUBSCRIPTION_PLAN_NAMES.has(String(name || "").trim());
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
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
    const subscriptionId = String(
      body.subscription_id || body.subscriptionId || "",
    ).trim();
    const action = String(body.action || "").trim();

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id mancante" },
        { status: 400 },
      );
    }

    if (!subscriptionId) {
      return NextResponse.json(
        { ok: false, error: "subscription_id mancante" },
        { status: 400 },
      );
    }

    if (action !== "update" && action !== "cancel") {
      return NextResponse.json(
        { ok: false, error: "Azione non valida" },
        { status: 400 },
      );
    }

    const { data: subscription, error: subscriptionError } =
      await supabaseAdmin
        .from("customer_subscriptions")
        .select("*, subscription_plans(name)")
        .eq("id", subscriptionId)
        .eq("customer_id", customerId)
        .maybeSingle();

    if (subscriptionError || !subscription) {
      return NextResponse.json(
        {
          ok: false,
          error: "Abbonamento non trovato",
          detail: subscriptionError,
        },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();

    if (action === "cancel") {
      const reason = String(body.reason || body.notes || "").trim();
      const cancelNote = reason
        ? `Annullato dalla reception: ${reason}`
        : "Annullato dalla reception.";

      const { data: updatedSubscription, error: updateError } =
        await supabaseAdmin
          .from("customer_subscriptions")
          .update({
            is_active: false,
            notes: appendNote(subscription.notes, cancelNote),
          })
          .eq("id", subscriptionId)
          .eq("customer_id", customerId)
          .select("*")
          .single();

      if (updateError || !updatedSubscription) {
        return NextResponse.json(
          {
            ok: false,
            error: "Errore annullamento abbonamento",
            detail: updateError,
          },
          { status: 500 },
        );
      }

      await supabaseAdmin.from("customer_timeline").insert({
        customer_id: customerId,
        type: "subscription",
        title: "Abbonamento annullato",
        description: `${subscription.subscription_plans?.name || "Abbonamento"} ${subscription.starts_at || "-"} - ${subscription.ends_at || "-"}${reason ? ` · Motivo: ${reason}` : ""}`,
        created_at: now,
      });

      return NextResponse.json({
        ok: true,
        action: "cancel",
        subscription: updatedSubscription,
      });
    }

    const planId = String(body.plan_id || body.planId || "").trim();
    const startsAt = dateOnly(
      body.starts_at || body.start_date || body.startsAt || "",
    );
    const endsAt = dateOnly(body.ends_at || body.end_date || body.endsAt || "");
    const amount = parseAmount(body.amount);
    const paymentMethod = normalizePaymentMethod(
      String(
        body.payment_method ||
          body.paymentMethod ||
          subscription.payment_method ||
          "cash",
      ),
    );
    const notes = String(body.notes || "").trim();

    if (!planId) {
      return NextResponse.json(
        { ok: false, error: "plan_id mancante" },
        { status: 400 },
      );
    }

    if (!startsAt || !isValidDateOnly(startsAt)) {
      return NextResponse.json(
        { ok: false, error: "Data inizio non valida" },
        { status: 400 },
      );
    }

    if (!endsAt || !isValidDateOnly(endsAt)) {
      return NextResponse.json(
        { ok: false, error: "Data fine non valida" },
        { status: 400 },
      );
    }

    if (endsAt < startsAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "La data fine non può essere precedente alla data inizio",
        },
        { status: 400 },
      );
    }

    if (amount === null || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Importo non valido" },
        { status: 400 },
      );
    }

    const { data: plan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, name, is_active")
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
      return NextResponse.json(
        { ok: false, error: "Piano non ammesso per la rettifica" },
        { status: 400 },
      );
    }

    if (plan.is_active === false) {
      return NextResponse.json(
        { ok: false, error: "Piano abbonamento non attivo" },
        { status: 400 },
      );
    }

    const oldPlanName = subscription.subscription_plans?.name || "Abbonamento";
    const oldStartsAt = dateOnly(subscription.starts_at || "");
    const oldEndsAt = dateOnly(subscription.ends_at || "");
    const oldAmount = Number(subscription.amount || 0);
    const oldDescription = planDescription(oldPlanName, oldStartsAt, oldEndsAt);
    const newDescription = planDescription(plan.name, startsAt, endsAt);
    const editNote = notes
      ? `Modifica reception: ${notes}`
      : "Modificato dalla reception.";

    const { data: updatedSubscription, error: updateError } =
      await supabaseAdmin
        .from("customer_subscriptions")
        .update({
          plan_id: planId,
          starts_at: startsAt,
          ends_at: endsAt,
          amount,
          payment_method: paymentMethod,
          notes: appendNote(subscription.notes, editNote),
        })
        .eq("id", subscriptionId)
        .eq("customer_id", customerId)
        .select("*")
        .single();

    if (updateError || !updatedSubscription) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore modifica abbonamento",
          detail: updateError,
        },
        { status: 500 },
      );
    }

    const { data: linkedReceipts } = await supabaseAdmin
      .from("customer_receipts")
      .select("id, payment_id")
      .eq("customer_id", customerId)
      .eq("subscription_id", subscriptionId);

    const linkedCustomerPaymentIds = Array.from(
      new Set(
        (linkedReceipts || [])
          .map((receipt) => receipt.payment_id)
          .filter((paymentId): paymentId is string => Boolean(paymentId)),
      ),
    );

    if (linkedCustomerPaymentIds.length > 0) {
      const { data: linkedCustomerPayments } = await supabaseAdmin
        .from("customer_payments")
        .select("id, notes")
        .eq("customer_id", customerId)
        .in("id", linkedCustomerPaymentIds);

      await Promise.all(
        (linkedCustomerPayments || []).map((payment) =>
          supabaseAdmin
            .from("customer_payments")
            .update({
              amount,
              payment_method: paymentMethod,
              description: newDescription,
              notes: appendNote(payment.notes, editNote),
            })
            .eq("customer_id", customerId)
            .eq("id", payment.id),
        ),
      );

      await supabaseAdmin
        .from("payments")
        .update({
          amount,
          description: newDescription,
          payment_type: "subscription",
          status: "paid",
        })
        .eq("customer_id", customerId)
        .in("id", linkedCustomerPaymentIds);
    }

    await supabaseAdmin
      .from("payments")
      .update({
        amount,
        description: newDescription,
        payment_type: "subscription",
        status: "paid",
      })
      .eq("customer_id", customerId)
      .eq("payment_type", "subscription")
      .eq("status", "paid")
      .eq("amount", oldAmount)
      .eq("description", oldDescription);

    await supabaseAdmin.from("customer_timeline").insert({
      customer_id: customerId,
      type: "subscription",
      title: "Abbonamento modificato",
      description:
        `${oldPlanName} ${oldStartsAt || "-"} - ${oldEndsAt || "-"} → ` +
        `${plan.name} €${amount.toFixed(2)} valido dal ${startsAt} al ${endsAt}` +
        ` · Metodo: ${paymentMethod}` +
        (notes ? ` · Note: ${notes}` : ""),
      created_at: now,
    });

    return NextResponse.json({
      ok: true,
      action: "update",
      subscription: updatedSubscription,
      linked_customer_payments_updated: linkedCustomerPaymentIds.length,
      receipts_updated: false,
    });
  } catch (error: unknown) {
    console.error("update-subscription fatal error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      },
      { status: 500 },
    );
  }
}
