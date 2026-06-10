import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

function normalizeText(value: unknown) {
  return String(value || "").trim();
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
        { status: 500 }
      );
    }

    const body = await req.json();

    const paymentId = normalizeText(body.payment_id);
    const customerId = normalizeText(body.customer_id);
    const cancellationReason = normalizeText(body.cancellation_reason);

    if (!paymentId) {
      return NextResponse.json(
        { ok: false, error: "ID pagamento mancante." },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "ID cliente mancante." },
        { status: 400 }
      );
    }

    if (!cancellationReason) {
      return NextResponse.json(
        { ok: false, error: "Motivo annullamento obbligatorio." },
        { status: 400 }
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
        { status: 500 }
      );
    }

    if (!existingPayment) {
      return NextResponse.json(
        { ok: false, error: "Pagamento cliente non trovato." },
        { status: 404 }
      );
    }

    const cancellationNote = `[Annullamento ${new Date().toLocaleString(
      "it-IT"
    )}] ${cancellationReason}`;

    const { data: cancelledPayment, error: cancelError } = await supabase
      .from("customer_payments")
      .update({
        status: "cancelled",
        notes: appendNote(existingPayment.notes || null, cancellationNote),
      })
      .eq("id", paymentId)
      .eq("customer_id", customerId)
      .select("*")
      .single();

    if (cancelError) {
      return NextResponse.json(
        { ok: false, error: cancelError.message },
        { status: 500 }
      );
    }

    /*
      Allineamento prudente:
      se payment_id coincide anche con payments.id, annulliamo anche payments.
      Non cancelliamo record fisicamente.
      Non tocchiamo ricevute A4, abbonamenti, cash_movements o prima nota.
    */
    await supabase
      .from("payments")
      .update({
        status: "cancelled",
        description:
          existingPayment.description ||
          `Pagamento annullato. Motivo: ${cancellationReason}`,
      })
      .eq("id", paymentId)
      .eq("customer_id", customerId);

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "payment",
      title: "Pagamento annullato",
      description: `Pagamento di €${Number(existingPayment.amount || 0).toFixed(
        2
      )} annullato. Motivo: ${cancellationReason}`,
    });

    return NextResponse.json({
      ok: true,
      payment: cancelledPayment,
      receipt_cancelled: false,
      cash_movement_cancelled: false,
      subscription_cancelled: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Errore imprevisto durante l'annullamento pagamento.",
      },
      { status: 500 }
    );
  }
}