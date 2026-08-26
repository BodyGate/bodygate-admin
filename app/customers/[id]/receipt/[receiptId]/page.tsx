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

function receiptComponents(receipt: any) {
  return Array.isArray(receipt?.receipt_components)
    ? receipt.receipt_components.filter((component: any) => component && component.label)
    : [];
}

function paymentMethodLabel(method?: string | null) {
  if (method === "cash") return "Contanti";
  if (method === "pos") return "POS";
  if (method === "bank_transfer") return "Bonifico";
  return method || "Contanti";
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

  const [customerRes, paymentRes, subscriptionRes] = await Promise.all([
    supabaseAdmin.from("customers").select("*").eq("id", customerId).maybeSingle(),
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
  const components = receiptComponents(receipt);

  return (
    <section className="receipt-copy">
      <header className="receipt-header">
        <div>
          <div className="brand">BODY ENERGY A.S.D.</div>
          <div className="muted">Viale Amedeo D&apos;Aosta 3, Palermo</div>
          <div className="muted">C.F. 97308970827</div>
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
          <div>Metodo pagamento: {paymentMethodLabel(payment?.payment_method)}</div>
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
          {components.length ? (
            components.map((component: any) => (
              <tr key={component.code || component.label}>
                <td>
                  <strong>{component.label}</strong>
                  <br />
                  <span className="muted">{receipt.description || payment?.description || "Ricevuta cliente"}</span>
                </td>
                <td>
                  {component.code === "subscription" && subscription ? (
                    <>
                      {formatDate(subscription.starts_at)}
                      <br />
                      {formatDate(subscription.ends_at)}
                    </>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="right amount">{formatEuro(component.amount)}</td>
              </tr>
            ))
          ) : (
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
          )}
        </tbody>
      </table>

      <div className="total-row">
        <span>Totale pagato</span>
        <strong>{formatEuro(receipt.amount)}</strong>
      </div>

      <div className="legal-note">
        Somma non soggetta ad IVA ai sensi del quarto comma dell&apos; Art.10 del D.P.R. 633/72
        e successive modifiche ed integrazioni.
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
        <button type="button" className="print-fallback">
          Stampa
        </button>
      </div>

      <div className="a4-sheet">
        <ReceiptCopy
          label={receipt.customer_copy_label || "COPIA CLIENTE"}
          receipt={receipt}
          customer={customer}
          payment={payment}
          subscription={subscription}
          plan={plan}
        />

        <div className="cut-line">
          <span>✂ taglio</span>
        </div>

        <ReceiptCopy
          label={receipt.gym_copy_label || "COPIA PALESTRA"}
          receipt={receipt}
          customer={customer}
          payment={payment}
          subscription={subscription}
          plan={plan}
        />
      </div>

      {shouldPrint ? (
        <script
          dangerouslySetInnerHTML={{
            __html: "setTimeout(function(){ window.print(); }, 650);",
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

        html,
        body {
          margin: 0;
          background: #e5e7eb;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
        }

        .page {
          min-height: 100vh;
          padding: 20px;
        }

        .toolbar {
          max-width: 210mm;
          margin: 0 auto 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .toolbar a,
        .toolbar button {
          border: 0;
          border-radius: 12px;
          padding: 11px 15px;
          background: #111827;
          color: white;
          text-decoration: none;
          font-weight: 800;
          cursor: pointer;
        }

        .a4-sheet {
          width: 210mm;
          height: 297mm;
          max-width: 100%;
          margin: 0 auto;
          background: white;
          border: 1px solid #d1d5db;
          display: grid;
          grid-template-rows: 1fr auto 1fr;
          overflow: hidden;
        }

        .receipt-copy {
          width: 100%;
          height: 100%;
          padding: 8mm 11mm 6mm;
          background: white;
          overflow: hidden;
        }

        .receipt-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 2px solid #111827;
          padding-bottom: 7px;
        }

        .brand {
          font-size: 19px;
          font-weight: 950;
          letter-spacing: -0.4px;
          color: #3d2b99;
        }

        .muted {
          color: #6b7280;
          font-size: 10.2px;
          line-height: 1.3;
        }

        .copy-label {
          border: 2px solid #3d2b99;
          color: #3d2b99;
          padding: 6px 10px;
          border-radius: 8px;
          font-weight: 950;
          font-size: 12px;
          align-self: flex-start;
          white-space: nowrap;
        }

        .receipt-title {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin: 9px 0;
          gap: 16px;
        }

        h1 {
          margin: 0;
          font-size: 22px;
          letter-spacing: -0.7px;
        }

        .receipt-title p {
          margin: 3px 0 0;
          color: #6b7280;
          font-size: 10.3px;
        }

        .receipt-number {
          text-align: right;
          color: #374151;
          font-size: 10.8px;
        }

        .receipt-number strong {
          display: block;
          font-size: 13.5px;
          color: #111827;
          margin-top: 2px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 8px;
        }

        .box {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 7px;
          font-size: 10.5px;
          line-height: 1.3;
        }

        .box-title {
          color: #3d2b99;
          font-weight: 950;
          text-transform: uppercase;
          font-size: 9.3px;
          letter-spacing: 0.7px;
          margin-bottom: 4px;
        }

        .strong {
          font-weight: 950;
          font-size: 11.8px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
        }

        th {
          text-align: left;
          background: #111827;
          color: white;
          padding: 6px;
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        td {
          border: 1px solid #d1d5db;
          padding: 7px 6px;
          vertical-align: top;
        }

        .right {
          text-align: right;
        }

        .amount {
          font-weight: 950;
          font-size: 12.5px;
        }

        .total-row {
          margin-top: 8px;
          display: flex;
          justify-content: flex-end;
          gap: 18px;
          align-items: center;
          font-size: 12px;
        }

        .total-row strong {
          font-size: 18px;
          color: #3d2b99;
        }

        .legal-note {
          margin-top: 8px;
          padding: 6px 7px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          color: #374151;
          background: #f9fafb;
          font-size: 9.5px;
          line-height: 1.35;
          font-weight: 700;
        }

        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 42px;
          margin-top: 17px;
        }

        .line {
          height: 1px;
          background: #111827;
          margin-bottom: 5px;
        }

        .signatures span {
          font-size: 10.3px;
          color: #6b7280;
        }

        .cut-line {
          width: 100%;
          height: 8mm;
          display: flex;
          align-items: center;
          justify-content: center;
          border-top: 1px dashed #9ca3af;
          border-bottom: 1px dashed #9ca3af;
          color: #6b7280;
          font-size: 10px;
          line-height: 1;
        }

        .cut-line span {
          background: white;
          padding: 0 8px;
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
          html,
          body {
            width: 210mm;
            height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .page {
            width: 210mm;
            height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: hidden !important;
          }

          .no-print {
            display: none !important;
          }

          .a4-sheet {
            width: 210mm;
            height: 297mm;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            page-break-after: avoid;
            page-break-before: avoid;
            page-break-inside: avoid;
          }

          .receipt-copy,
          .cut-line {
            page-break-inside: avoid;
            break-inside: avoid;
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