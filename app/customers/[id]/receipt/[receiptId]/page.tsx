import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("it-IT");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEuro(value?: number | string | null) {
  const amount = Number(value || 0);
  return amount.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}

function customerName(customer: any) {
  return `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() || "Cliente";
}

async function loadReceipt(customerId: string, receiptId: string) {
  const { data: receipt, error: receiptError } = await supabaseAdmin
    .from("customer_receipts")
    .select("*")
    .eq("id", receiptId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (receiptError || !receipt) {
    return {
      receipt: null,
      customer: null,
      payment: null,
      subscription: null,
      plan: null,
      error: receiptError?.message || "Ricevuta non trovata",
    };
  }

  const [
    customerRes,
    paymentRes,
    subscriptionRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .maybeSingle(),
    receipt.payment_id
      ? supabaseAdmin
          .from("customer_payments")
          .select("*")
          .eq("id", receipt.payment_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    receipt.subscription_id
      ? supabaseAdmin
          .from("customer_subscriptions")
          .select("*")
          .eq("id", receipt.subscription_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ]);

  let plan: any = null;

  if (subscriptionRes.data?.plan_id) {
    const planRes = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("id", subscriptionRes.data.plan_id)
      .maybeSingle();

    plan = planRes.data || null;
  }

  return {
    receipt,
    customer: customerRes.data || null,
    payment: paymentRes.data || null,
    subscription: subscriptionRes.data || null,
    plan,
    error: null,
  };
}

function ReceiptCopy({
  label,
  receipt,
  customer,
  payment,
  subscription,
  plan,
}: {
  label: string;
  receipt: any;
  customer: any;
  payment: any;
  subscription: any;
  plan: any;
}) {
  const name = customerName(customer);

  return (
    <section className="receipt-copy">
      <header className="receipt-header">
        <div>
          <div className="brand">BODY ENERGY A.S.D.</div>
          <div className="muted">Viale Amedeo D&apos;Aosta 3, Palermo</div>
          <div className="muted">Tel. 0917785001 · bodyenergy.asd@gmail.com</div>
        </div>

        <div className="copy-label">{label}</div>
      </header>

      <div className="receipt-title">
        <div>
          <h1>Ricevuta</h1>
          <p>Ricevuta non fiscale per attività istituzionale ASD</p>
        </div>

        <div className="receipt-number">
          <span>N.</span>
          <strong>{receipt.receipt_number}</strong>
        </div>
      </div>

      <div className="grid">
        <div className="box">
          <div className="box-title">Cliente</div>
          <div className="strong">{name}</div>
          {customer?.fiscal_code ? <div>Cod. fisc.: {customer.fiscal_code}</div> : null}
          {customer?.phone ? <div>Tel.: {customer.phone}</div> : null}
          {customer?.email ? <div>Email: {customer.email}</div> : null}
        </div>

        <div className="box">
          <div className="box-title">Emissione</div>
          <div>Data: {formatDateTime(receipt.issued_at || receipt.created_at)}</div>
          <div>Metodo pagamento: {payment?.payment_method || "cash"}</div>
          <div>Tipo: {receipt.receipt_type || "subscription"}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Descrizione</th>
            <th>Periodo</th>
            <th className="right">Importo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>{plan?.name || payment?.description || receipt.description || "Abbonamento"}</strong>
              <br />
              <span className="muted">
                {receipt.description || payment?.description || "Rinnovo abbonamento"}
              </span>
            </td>
            <td>
              {subscription ? (
                <>
                  {formatDate(subscription.starts_at)}
                  <br />
                  {formatDate(subscription.ends_at)}
                </>
              ) : (
                "-"
              )}
            </td>
            <td className="right amount">{formatEuro(receipt.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div className="total-row">
        <span>Totale pagato</span>
        <strong>{formatEuro(receipt.amount)}</strong>
      </div>

      <div className="signatures">
        <div>
          <div className="line" />
          <span>Firma cliente</span>
        </div>

        <div>
          <div className="line" />
          <span>Firma incaricato</span>
        </div>
      </div>

      <footer>
        Documento generato da BodyGate. Conservare la copia palestra per registro interno.
      </footer>
    </section>
  );
}

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{
    id: string;
    receiptId: string;
  }>;
  searchParams?: Promise<{
    print?: string;
  }>;
}) {
  const { id, receiptId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const { receipt, customer, payment, subscription, plan, error } = await loadReceipt(
    id,
    receiptId
  );

  if (error || !receipt) {
    return (
      <main className="page">
        <div className="error-box">
          <h1>Ricevuta non trovata</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  const shouldPrint = resolvedSearchParams?.print === "1";

  return (
    <main className="page">
      <div className="toolbar no-print">
        <a href={`/customers/${id}`}>← Torna al cliente</a>
        <button onClick={undefined as any} className="hidden-button" />
        <button
          type="button"
          onClick={undefined as any}
          className="print-fallback"
        >
          Stampa
        </button>
      </div>

      <ReceiptCopy
        label={receipt.customer_copy_label || "COPIA CLIENTE"}
        receipt={receipt}
        customer={customer}
        payment={payment}
        subscription={subscription}
        plan={plan}
      />

      <div className="cut-line">✂</div>

      <ReceiptCopy
        label={receipt.gym_copy_label || "COPIA PALESTRA"}
        receipt={receipt}
        customer={customer}
        payment={payment}
        subscription={subscription}
        plan={plan}
      />

      {shouldPrint ? (
        <script
          dangerouslySetInnerHTML={{
            __html: "setTimeout(function(){ window.print(); }, 500);",
          }}
        />
      ) : null}

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener("click", function(event) {
              var target = event.target;
              if (target && target.classList && target.classList.contains("print-fallback")) {
                window.print();
              }
            });
          `,
        }}
      />

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #e5e7eb;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
        }

        .page {
          min-height: 100vh;
          padding: 24px;
        }

        .toolbar {
          max-width: 900px;
          margin: 0 auto 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .toolbar a,
        .toolbar button {
          border: 0;
          border-radius: 12px;
          padding: 12px 16px;
          background: #111827;
          color: white;
          text-decoration: none;
          font-weight: 800;
          cursor: pointer;
        }

        .hidden-button {
          display: none;
        }

        .receipt-copy {
          width: 210mm;
          min-height: 138mm;
          max-width: 100%;
          margin: 0 auto;
          background: white;
          border: 1px solid #d1d5db;
          padding: 13mm;
          page-break-inside: avoid;
        }

        .receipt-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 3px solid #111827;
          padding-bottom: 12px;
        }

        .brand {
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.5px;
          color: #991b1b;
        }

        .muted {
          color: #6b7280;
          font-size: 12px;
          line-height: 1.5;
        }

        .copy-label {
          border: 2px solid #991b1b;
          color: #991b1b;
          padding: 8px 12px;
          border-radius: 8px;
          font-weight: 950;
          font-size: 14px;
          align-self: flex-start;
          white-space: nowrap;
        }

        .receipt-title {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin: 18px 0;
          gap: 20px;
        }

        h1 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -1px;
        }

        .receipt-title p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .receipt-number {
          text-align: right;
          color: #374151;
          font-size: 13px;
        }

        .receipt-number strong {
          display: block;
          font-size: 17px;
          color: #111827;
          margin-top: 3px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .box {
          border: 1px solid #d1d5db;
          border-radius: 10px;
          padding: 12px;
          font-size: 13px;
          line-height: 1.55;
        }

        .box-title {
          color: #991b1b;
          font-weight: 950;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.8px;
          margin-bottom: 5px;
        }

        .strong {
          font-weight: 950;
          font-size: 15px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        th {
          text-align: left;
          background: #111827;
          color: white;
          padding: 10px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        td {
          border: 1px solid #d1d5db;
          padding: 12px 10px;
          vertical-align: top;
        }

        .right {
          text-align: right;
        }

        .amount {
          font-weight: 950;
          font-size: 16px;
        }

        .total-row {
          margin-top: 14px;
          display: flex;
          justify-content: flex-end;
          gap: 24px;
          align-items: center;
          font-size: 16px;
        }

        .total-row strong {
          font-size: 24px;
          color: #991b1b;
        }

        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 50px;
          margin-top: 28px;
        }

        .line {
          height: 1px;
          background: #111827;
          margin-bottom: 6px;
        }

        .signatures span {
          font-size: 12px;
          color: #6b7280;
        }

        footer {
          margin-top: 18px;
          color: #6b7280;
          font-size: 11px;
          border-top: 1px solid #e5e7eb;
          padding-top: 8px;
        }

        .cut-line {
          width: 210mm;
          max-width: 100%;
          margin: 8px auto;
          color: #6b7280;
          text-align: center;
          border-top: 1px dashed #9ca3af;
          line-height: 0;
        }

        .error-box {
          max-width: 700px;
          margin: 60px auto;
          background: white;
          border-radius: 18px;
          padding: 30px;
          border: 1px solid #e5e7eb;
        }

        @media print {
          body {
            background: white;
          }

          .page {
            padding: 0;
          }

          .no-print {
            display: none !important;
          }

          .receipt-copy {
            width: 100%;
            min-height: 138mm;
            border: 0;
            margin: 0;
            padding: 9mm 12mm;
          }

          .cut-line {
            margin: 0;
            width: 100%;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </main>
  );
}
