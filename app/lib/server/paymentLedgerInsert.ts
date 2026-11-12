// Used by POST /api/payments/create. The accounting row (`payments`) and
// the customer-facing row (`customer_payments`) are two separate inserts,
// not one transaction. Without compensation, a failure on the second
// insert (constraint violation, transient DB error, …) leaves an orphaned
// `payments` row with no matching `customer_payments` entry — an
// accounting total with no visible counterpart in the customer's history.

export type InsertedRow = { id: string };

type InsertOutcome = {
  data: InsertedRow | null;
  error: { message: string } | null;
};

export interface SelectedInsertLike {
  single(): PromiseLike<InsertOutcome>;
}

export interface InsertQueryLike {
  select(columns: string): SelectedInsertLike;
}

export interface DeleteQueryLike {
  eq(
    column: string,
    value: string,
  ): PromiseLike<{ error: { message: string } | null }>;
}

export interface PaymentLedgerDb {
  from(table: string): {
    insert(values: Record<string, unknown>): InsertQueryLike;
    delete(): DeleteQueryLike;
  };
}

export type PaymentLedgerResult =
  | { ok: true; paymentId: string; customerPaymentId: string }
  | { ok: false; error: string };

export async function insertPaymentLedgerPair(
  db: PaymentLedgerDb,
  accountingRow: Record<string, unknown>,
  customerRow: Record<string, unknown>,
): Promise<PaymentLedgerResult> {
  const { data: payment, error: paymentError } = await db
    .from("payments")
    .insert(accountingRow)
    .select("id")
    .single();

  if (paymentError || !payment) {
    return {
      ok: false,
      error: paymentError?.message || "Errore creazione pagamento.",
    };
  }

  const { data: customerPayment, error: customerPaymentError } = await db
    .from("customer_payments")
    .insert(customerRow)
    .select("id")
    .single();

  if (customerPaymentError || !customerPayment) {
    await db.from("payments").delete().eq("id", payment.id);

    return {
      ok: false,
      error:
        customerPaymentError?.message || "Errore creazione pagamento cliente.",
    };
  }

  return {
    ok: true,
    paymentId: payment.id,
    customerPaymentId: customerPayment.id,
  };
}
