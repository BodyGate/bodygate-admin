import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

    const { data: payments, error } = await supabaseAdmin
      .from("customer_payments")
      .select("*")
      .eq("customer_id", customerId)
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore caricamento pagamenti cliente",
          detail: error,
        },
        { status: 500 }
      );
    }

    const paymentIds = (payments || []).map((p: any) => p.id);

    let receipts: any[] = [];
    if (paymentIds.length > 0) {
      const { data: receiptsData, error: receiptsError } = await supabaseAdmin
        .from("customer_receipts")
        .select("id, payment_id, receipt_number, receipt_components")
        .in("payment_id", paymentIds);

      if (!receiptsError && receiptsData) {
        receipts = receiptsData;
      }
    }

    const receiptByPaymentId = new Map(
      receipts.map((receipt: any) => [receipt.payment_id, receipt])
    );

    const enrichedPayments = (payments || []).map((payment: any) => {
      const receipt = receiptByPaymentId.get(payment.id);

      return {
        ...payment,
        receipt_id: receipt?.id || null,
        receipt_number: receipt?.receipt_number || null,
        receipt_components: receipt?.receipt_components || null,
      };
    });

    return NextResponse.json({
      ok: true,
      customer_id: customerId,
      count: enrichedPayments.length,
      payments: enrichedPayments,
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
