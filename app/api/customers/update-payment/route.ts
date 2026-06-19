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

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function sameDate(a: unknown, b: unknown) {
  const da = String(a || "").slice(0, 10);
  const db = String(b || "").slice(0, 10);
  return Boolean(da && db && da === db);
}

function amountChanged(previous: unknown, next: unknown) {
  return Number(previous || 0).toFixed(2) !== Number(next || 0).toFixed(2);
}

function textChanged(previous: unknown, next: unknown) {
  return normalizeText(previous) !== normalizeText(next);
}

function appendNote(previousNotes: string | null, newNote: string) {
  const previous = normalizeText(previousNotes);
  if (!previous) return newNote;
  return `${previous}\n\n${newNote}`;
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

    const paymentId = normalizeText(body.payment_id);
    const customerId = normalizeText(body.customer_id);
    const amount = parseAmount(body.amount);
    const paymentMethod = normalizeText(body.payment_method) || "cash";
    const description = normalizeText(body.description);
    const status = normalizeText(body.status) || "paid";
    const correctionReason = normalizeText(body.correction_reason);
    const paidAt = body.paid_at ? new Date(body.paid_at) : null;

    if (!paymentId) {
      return NextResponse.json(
        { ok: false, error: "ID pagamento mancante." },
        { status: 400 },
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "ID cliente mancante." },
        { status: 400 },
      );
    }

    if (!amount) {
      return NextResponse.json(
        { ok: false, error: "Importo non valido." },
        { status: 400 },
      );
    }

    if (!correctionReason) {
      return NextResponse.json(
        { ok: false, error: "Motivo rettifica obbligatorio." },
        { status: 400 },
      );
    }

    if (paidAt && Number.isNaN(paidAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Data pagamento non valida." },
        { status: 400 },
      );
    }

    const { data: existingPayment, error: existingError } = await supabase
      .from("customer_payments")
      .select("*")
      .eq("id", paymentId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { ok: false, error: existingError.message },
        { status: 500 },
      );
    }

    if (!existingPayment) {
      return NextResponse.json(
        { ok: false, error: "Pagamento cliente non trovato." },
        { status: 404 },
      );
    }

    const { data: linkedReceipts, error: receiptsError } = await supabase
      .from("customer_receipts")
      .select("id, receipt_number, amount, receipt_type, subscription_id")
      .eq("payment_id", paymentId)
      .eq("customer_id", customerId);

    if (receiptsError) {
      return NextResponse.json(
        { ok: false, error: receiptsError.message },
        { status: 500 },
      );
    }

    const hasDocumentalChange =
      amountChanged(existingPayment.amount, amount) ||
      textChanged(existingPayment.description, description || null) ||
      textChanged(existingPayment.payment_method, paymentMethod) ||
      textChanged(existingPayment.status, status) ||
      (paidAt
        ? !sameDate(existingPayment.paid_at, paidAt.toISOString())
        : false);

    if ((linkedReceipts || []).length > 0 && hasDocumentalChange) {
      const receipt = linkedReceipts![0];
      return NextResponse.json(
        {
          ok: false,
          code: "LINKED_RECEIPT_PAYMENT_REQUIRES_CORRECTION",
          error:
            "Il pagamento è collegato a una ricevuta già emessa. Usa il flusso di rettifica amministrativa.",
          receipt: {
            id: receipt.id,
            receipt_number: receipt.receipt_number,
            amount: receipt.amount,
            receipt_type: receipt.receipt_type,
          },
        },
        { status: 409 },
      );
    }

    const previousDescription = normalizeText(existingPayment.description);
    const { data: plausibleAccountingPayments } = await supabase
      .from("payments")
      .select("*")
      .eq("customer_id", customerId)
      .eq("payment_type", existingPayment.type)
      .limit(20);

    const accountingPayment = (plausibleAccountingPayments || []).find(
      (payment) => {
        return (
          payment.id === paymentId ||
          (sameDate(
            payment.paid_at || payment.created_at,
            existingPayment.paid_at || existingPayment.created_at,
          ) &&
            amountChanged(payment.amount, existingPayment.amount) === false) ||
          (previousDescription &&
            normalizeText(payment.description) === previousDescription)
        );
      },
    );

    const correctionNote = `[Rettifica ${new Date().toLocaleString(
      "it-IT",
    )}] ${correctionReason}`;

    const { data: updatedPayment, error: updateError } = await supabase
      .from("customer_payments")
      .update({
        amount,
        payment_method: paymentMethod,
        description: description || null,
        paid_at: paidAt ? paidAt.toISOString() : existingPayment.paid_at,
        status,
        notes: appendNote(existingPayment.notes || null, correctionNote),
      })
      .eq("id", paymentId)
      .eq("customer_id", customerId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 },
      );
    }

    if (accountingPayment?.id) {
      await supabase
        .from("payments")
        .update({
          amount,
          description: description || null,
          status,
          paid_at: paidAt ? paidAt.toISOString() : existingPayment.paid_at,
        })
        .eq("id", accountingPayment.id)
        .eq("customer_id", customerId);
    }

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "payment",
      title: "Pagamento rettificato",
      description: `Pagamento rettificato a €${amount.toFixed(
        2,
      )}. Motivo: ${correctionReason}`,
    });

    return NextResponse.json({
      ok: true,
      payment: updatedPayment,
      receipt_updated: false,
      cash_movement_updated: false,
      subscription_updated: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message || "Errore imprevisto durante la modifica pagamento.",
      },
      { status: 500 },
    );
  }
}
