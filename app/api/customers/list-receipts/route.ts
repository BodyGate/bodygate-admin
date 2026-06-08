import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const customerId = String(searchParams.get("customer_id") || "").trim();

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id mancante" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: receipts, error } = await supabaseAdmin
      .from("customer_receipts")
      .select("*")
      .eq("customer_id", customerId)
      .order("issued_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore caricamento ricevute cliente",
          detail: error,
        },
        { status: 500 }
      );
    }

    const paymentIds = Array.from(
      new Set(
        (receipts || [])
          .map((receipt: any) => receipt.payment_id)
          .filter((paymentId: string | null | undefined) => !!paymentId)
      )
    );

    let paymentMethodById = new Map<string, string | null>();

    if (paymentIds.length > 0) {
      const { data: payments } = await supabaseAdmin
        .from("customer_payments")
        .select("id, payment_method")
        .in("id", paymentIds);

      paymentMethodById = new Map(
        (payments || []).map((payment: any) => [payment.id, payment.payment_method || null])
      );
    }

    const normalizedReceipts = (receipts || []).map((receipt: any) => ({
      id: receipt.id,
      customer_id: receipt.customer_id,
      payment_id: receipt.payment_id || null,
      subscription_id: receipt.subscription_id || null,
      receipt_number: receipt.receipt_number || null,
      receipt_type: receipt.receipt_type || null,
      description: receipt.description || null,
      amount: receipt.amount ?? null,
      payment_method:
        receipt.payment_method ||
        (receipt.payment_id ? paymentMethodById.get(receipt.payment_id) : null) ||
        null,
      issued_at: receipt.issued_at || null,
      created_at: receipt.created_at || null,
      customer_copy_label: receipt.customer_copy_label || null,
      gym_copy_label: receipt.gym_copy_label || null,
    }));

    return NextResponse.json({
      ok: true,
      receipts: normalizedReceipts,
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
