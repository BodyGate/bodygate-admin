import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ReceiptNumberPayload = {
  receipt_year: number;
  receipt_sequence: number;
  receipt_number: string;
};

function createSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

function parseAmount(value: unknown) {
  const amount = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function normalizeDate(value: unknown) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return date;
}

function normalizePaymentMethod(value: unknown) {
  return String(value || "").trim();
}

function parseReceiptNumberPayload(data: unknown): ReceiptNumberPayload | null {
  const payload = Array.isArray(data) ? data[0] : data;

  if (!payload || typeof payload !== "object") return null;

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

async function getNextReceiptNumber(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin.rpc(
    "next_bodygate_receipt_number_v2",
  );

  if (error) {
    console.error("next_bodygate_receipt_number_v2 error", error);
    throw new Error(
      "Numerazione ricevuta non disponibile: impossibile generare la ricevuta quota associativa.",
    );
  }

  const receiptNumber = parseReceiptNumberPayload(data);

  if (!receiptNumber) {
    console.error("next_bodygate_receipt_number_v2 invalid payload", data);
    throw new Error(
      "Numerazione ricevuta non valida: impossibile generare la ricevuta quota associativa.",
    );
  }

  return receiptNumber;
}

function membershipYearFromDate(validFrom: string) {
  return Number(validFrom.slice(0, 4));
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createSupabaseAdmin();

    if (!supabaseAdmin) {
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
    const customerId = String(body.customer_id || body.customerId || "").trim();
    const amount = parseAmount(body.amount);
    const paymentMethod = normalizePaymentMethod(
      body.payment_method || body.paymentMethod,
    );
    const validFrom = normalizeDate(body.valid_from || body.validFrom);
    const validUntil = normalizeDate(body.valid_until || body.validUntil);
    const allowDuplicate = body.allow_duplicate === true;

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id obbligatorio." },
        { status: 400 },
      );
    }

    if (!amount) {
      return NextResponse.json(
        { ok: false, error: "Importo quota associativa obbligatorio e maggiore di zero." },
        { status: 400 },
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { ok: false, error: "Metodo pagamento obbligatorio." },
        { status: 400 },
      );
    }

    if (!validFrom) {
      return NextResponse.json(
        { ok: false, error: "Data inizio validità quota obbligatoria." },
        { status: 400 },
      );
    }

    if (!validUntil) {
      return NextResponse.json(
        { ok: false, error: "Data fine validità quota obbligatoria." },
        { status: 400 },
      );
    }

    if (validUntil < validFrom) {
      return NextResponse.json(
        { ok: false, error: "La data fine validità deve essere successiva o uguale alla data inizio." },
        { status: 400 },
      );
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("id, branch_id, first_name, last_name")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError) {
      return NextResponse.json(
        { ok: false, error: customerError.message },
        { status: 500 },
      );
    }

    if (!customer) {
      return NextResponse.json(
        { ok: false, error: "Cliente non trovato." },
        { status: 404 },
      );
    }

    if (!allowDuplicate) {
      const { data: duplicateFee, error: duplicateFeeError } = await supabaseAdmin
        .from("customer_membership_fees")
        .select("id, valid_from, valid_until")
        .eq("customer_id", customerId)
        .eq("valid_from", validFrom)
        .eq("valid_until", validUntil)
        .limit(1)
        .maybeSingle();

      if (duplicateFeeError) {
        return NextResponse.json(
          { ok: false, error: duplicateFeeError.message },
          { status: 500 },
        );
      }

      if (duplicateFee) {
        return NextResponse.json(
          {
            ok: false,
            code: "DUPLICATE_MEMBERSHIP_FEE",
            error:
              "Esiste già una quota associativa per lo stesso cliente e lo stesso periodo.",
          },
          { status: 409 },
        );
      }

      const { data: duplicateReceipt, error: duplicateReceiptError } =
        await supabaseAdmin
          .from("customer_receipts")
          .select("id, receipt_number")
          .eq("customer_id", customerId)
          .eq("receipt_type", "membership_fee")
          .ilike(
            "description",
            `%Quota associativa Body Energy ASD anno ${membershipYearFromDate(validFrom)}%`,
          )
          .limit(1)
          .maybeSingle();

      if (duplicateReceiptError) {
        return NextResponse.json(
          { ok: false, error: duplicateReceiptError.message },
          { status: 500 },
        );
      }

      if (duplicateReceipt) {
        return NextResponse.json(
          {
            ok: false,
            code: "DUPLICATE_MEMBERSHIP_RECEIPT",
            error:
              "Esiste già una ricevuta di quota associativa per lo stesso anno. Conferma esplicitamente per procedere.",
          },
          { status: 409 },
        );
      }
    }

    const now = new Date().toISOString();
    const year = membershipYearFromDate(validFrom);
    const description = `Quota associativa Body Energy ASD anno ${year}`;

    const { data: membershipFee, error: membershipFeeError } = await supabaseAdmin
      .from("customer_membership_fees")
      .insert({
        customer_id: customerId,
        branch_id: customer.branch_id || null,
        amount,
        valid_from: validFrom,
        valid_until: validUntil,
        payment_method: paymentMethod,
        notes: description,
      })
      .select("id, valid_from, valid_until")
      .single();

    if (membershipFeeError || !membershipFee) {
      return NextResponse.json(
        {
          ok: false,
          error:
            membershipFeeError?.message ||
            "Quota associativa non registrata.",
        },
        { status: 500 },
      );
    }

    const { data: customerPayment, error: customerPaymentError } =
      await supabaseAdmin
        .from("customer_payments")
        .insert({
          customer_id: customerId,
          amount,
          type: "membership_fee",
          description,
          payment_method: paymentMethod,
          status: "paid",
          paid_at: now,
          notes: `Validità ${validFrom} - ${validUntil}`,
        })
        .select("id")
        .single();

    if (customerPaymentError || !customerPayment) {
      return NextResponse.json(
        {
          ok: false,
          error:
            customerPaymentError?.message ||
            "Quota registrata ma pagamento cliente non creato.",
          membership_fee_id: membershipFee.id,
        },
        { status: 500 },
      );
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        customer_id: customerId,
        payment_method_id: null,
        amount,
        payment_type: "membership_fee",
        description,
        status: "paid",
        paid_at: now,
        created_by: "admin@bodygate.it",
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        {
          ok: false,
          error:
            paymentError?.message ||
            "Quota registrata ma pagamento generale non creato.",
          membership_fee_id: membershipFee.id,
          customer_payment_id: customerPayment.id,
        },
        { status: 500 },
      );
    }

    const receiptNumber = await getNextReceiptNumber(supabaseAdmin);

    const { data: receipt, error: receiptError } = await supabaseAdmin
      .from("customer_receipts")
      .insert({
        customer_id: customerId,
        payment_id: customerPayment.id,
        receipt_year: receiptNumber.receipt_year,
        receipt_sequence: receiptNumber.receipt_sequence,
        receipt_number: receiptNumber.receipt_number,
        receipt_type: "membership_fee",
        amount,
        description,
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
          error:
            receiptError?.message ||
            "Numero ricevuta generato, ma ricevuta quota associativa non salvata.",
          membership_fee_id: membershipFee.id,
          customer_payment_id: customerPayment.id,
          payment_id: payment.id,
        },
        { status: 500 },
      );
    }

    await supabaseAdmin.from("customer_timeline").insert({
      customer_id: customerId,
      type: "membership",
      title: "Quota associativa incassata",
      description: `${description} - €${amount.toFixed(2)} - ricevuta ${receipt.receipt_number}`,
      created_at: now,
    });

    const { data: contractDocument, error: contractError } =
      await supabaseAdmin
        .from("customer_documents")
        .insert({
          customer_id: customerId,
          document_type: "contract",
          title: `Contratto associativo Body Energy ASD ${validFrom} - ${validUntil}`,
          status: "generated",
        })
        .select("id")
        .single();

    if (contractError) {
      console.error("annual contract creation failed", contractError);
    }

    return NextResponse.json({
      ok: true,
      membership_fee: membershipFee,
      customer_payment_id: customerPayment.id,
      payment_id: payment.id,
      receipt,
      receipt_url: `/customers/${customerId}/receipt/${receipt.id}`,
      print_url: `/customers/${customerId}/receipt/${receipt.id}?print=1`,
      contract_document_id: contractDocument?.id || null,
      contract_url: `/customers/${customerId}/contract`,
      contract_created: Boolean(contractDocument?.id),
      contract_warning: contractError?.message || null,
      cash_movement_created: false,
      accounting_entry_created: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Errore imprevisto durante il rinnovo quota associativa.",
      },
      { status: 500 },
    );
  }
}
