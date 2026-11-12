// Used by POST /api/payments/create. The accounting row (`payments`) and
// the customer-facing row (`customer_payments`) must appear together: a
// client-side "insert, then insert, then delete the first one if the
// second fails" cannot tell a rejected insert from a committed insert
// whose network response was lost, so a "failure" doesn't always mean
// nothing was written. `create_misc_payment_atomic_v1` (see
// supabase/migrations) does both inserts in one Postgres transaction
// instead, so this wrapper only has to call it and shape the result.

export type MiscPaymentRow = { id: string };

type RpcOutcome = {
  data: { payment: MiscPaymentRow; customer_payment: MiscPaymentRow } | null;
  error: { message: string } | null;
};

export interface PaymentLedgerDb {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<RpcOutcome>;
}

export type PaymentLedgerArgs = {
  customerId: string | null;
  paymentMethodId: string | null;
  amount: number;
  paymentType: string;
  description: string | null;
  paymentMethodName: string;
  createdBy: string;
};

export type PaymentLedgerResult =
  | { ok: true; paymentId: string; customerPaymentId: string }
  | { ok: false; error: string };

export async function insertPaymentLedgerPair(
  db: PaymentLedgerDb,
  args: PaymentLedgerArgs,
): Promise<PaymentLedgerResult> {
  const { data, error } = await db.rpc("create_misc_payment_atomic_v1", {
    p_customer_id: args.customerId,
    p_payment_method_id: args.paymentMethodId,
    p_amount: args.amount,
    p_payment_type: args.paymentType,
    p_description: args.description,
    p_payment_method_name: args.paymentMethodName,
    p_created_by: args.createdBy,
  });

  if (error || !data?.payment?.id || !data?.customer_payment?.id) {
    return {
      ok: false,
      error: error?.message || "Errore creazione pagamento.",
    };
  }

  return {
    ok: true,
    paymentId: data.payment.id,
    customerPaymentId: data.customer_payment.id,
  };
}
