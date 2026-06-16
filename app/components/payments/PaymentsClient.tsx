"use client";

import { useEffect, useMemo, useState } from "react";
import BGActionLink from "../ui/BGActionLink";
import BGButton from "../ui/BGButton";
import BGCard from "../ui/BGCard";
import BGDataTable from "../ui/BGDataTable";
import BGEmptyState from "../ui/BGEmptyState";
import BGPageHeader from "../ui/BGPageHeader";
import BGStatCard from "../ui/BGStatCard";
import BGStatusBadge from "../ui/BGStatusBadge";
import { safeRandomId } from "../../lib/safeRandomId";
import { supabase } from "../../lib/supabaseClient";

type CustomerRelation = {
  first_name: string | null;
  last_name: string | null;
};

type PaymentMethodRelation = {
  name: string | null;
  method_key?: string | null;
};

type Payment = {
  id: string;
  customer_id: string | null;
  amount: number | string | null;
  payment_type: string | null;
  description: string | null;
  status: string | null;
  paid_at: string | null;
  created_at?: string | null;
  customers?: CustomerRelation | CustomerRelation[] | null;
  payment_methods?: PaymentMethodRelation | PaymentMethodRelation[] | null;
};

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);

  return amount.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPaymentType(type?: string | null) {
  if (type === "subscription") return "Abbonamento";
  if (type === "membership_fee" || type === "membership")
    return "Quota associativa";
  if (type === "training") return "Training";
  if (type === "product") return "Prodotto";
  if (type === "other") return "Altro";
  return type || "N/D";
}

function firstRelation<T>(value?: T | T[] | null) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function formatPaymentMethod(payment: Payment) {
  const paymentMethod = firstRelation(payment.payment_methods);
  const method = paymentMethod?.method_key || paymentMethod?.name;

  if (method === "cash") return "Contanti";
  if (method === "pos") return "POS";
  if (method === "bank_transfer") return "Bonifico";

  return method || "N/D";
}

function customerName(payment: Payment) {
  const customer = firstRelation(payment.customers);
  return `${customer?.last_name || ""} ${customer?.first_name || ""}`.trim();
}

function isToday(value?: string | null) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isCurrentMonth(value?: string | null) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function statusTone(
  status?: string | null,
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (!status || status === "paid" || status === "completed") return "success";
  if (status === "pending") return "warning";
  if (status === "cancelled" || status === "failed") return "danger";
  return "info";
}

export default function PaymentsClient() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadPayments() {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("payments")
      .select(
        `
        id,
        customer_id,
        amount,
        payment_type,
        description,
        status,
        paid_at,
        created_at,
        customers (
          first_name,
          last_name
        ),
        payment_methods (
          name,
          method_key
        )
      `,
      )
      .order("paid_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(100);

    if (error) {
      console.error("Errore caricamento pagamenti:", error);
      setPayments([]);
      setLoadError(error.message || "Errore caricamento pagamenti.");
      setLoading(false);
      return;
    }

    setPayments((data || []) as unknown as Payment[]);
    setLoading(false);
  }

  useEffect(() => {
    loadPayments();

    const channel = supabase
      .channel(safeRandomId("payments-readonly"))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        loadPayments,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const todayTotal = useMemo(() => {
    return payments
      .filter((payment) => isToday(payment.paid_at || payment.created_at))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }, [payments]);

  const monthTotal = useMemo(() => {
    return payments
      .filter((payment) =>
        isCurrentMonth(payment.paid_at || payment.created_at),
      )
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }, [payments]);

  const loadedTotal = useMemo(() => {
    return payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );
  }, [payments]);

  return (
    <main className="payments-page bg-page-shell">
      <BGPageHeader
        eyebrow="BodyGate Premium"
        title="Cassa / Pagamenti"
        subtitle="Pagina consultiva per monitorare gli incassi già registrati dai flussi ufficiali BodyGate."
        actions={
          <BGButton
            onClick={loadPayments}
            variant="secondary"
            disabled={loading}
          >
            {loading ? "Aggiornamento..." : "Aggiorna storico"}
          </BGButton>
        }
      />

      <BGCard className="payments-readonly-alert" variant="warning">
        <div className="payments-alert-content">
          <div>
            <div className="bg-eyebrow">Solo consultazione</div>
            <h2>Creazione incassi disabilitata</h2>
            <p>
              Per creare rinnovi, quote associative e ricevute usare la scheda
              cliente. Questa pagina è solo consultiva finché non verrà attivata
              la contabilità generale.
            </p>
          </div>
          <BGActionLink href="/customers" variant="primary">
            Apri clienti
          </BGActionLink>
        </div>
      </BGCard>

      <section
        className="bg-kpi-grid payments-kpi-grid"
        aria-label="Indicatori pagamenti"
      >
        <BGStatCard
          label="Incassi oggi"
          value={formatMoney(todayTotal)}
          note="Somma pagamenti caricati con data odierna"
          tone="green"
        />
        <BGStatCard
          label="Incassi mese"
          value={formatMoney(monthTotal)}
          note="Somma pagamenti caricati nel mese corrente"
          tone="blue"
        />
        <BGStatCard
          label="Operazioni caricate"
          value={payments.length}
          note="Ultimi pagamenti letti dallo storico"
          tone="neutral"
        />
        <BGStatCard
          label="Totale caricato"
          value={formatMoney(loadedTotal)}
          note="Totale ultimi pagamenti mostrati"
          tone="red"
        />
      </section>

      <BGCard className="payments-history-card" variant="premium">
        <div className="bg-section-header payments-section-header">
          <div>
            <div className="bg-eyebrow">Storico pagamenti</div>
            <h2>Ultime operazioni</h2>
            <p>
              Lettura delle ultime 100 operazioni presenti nella tabella
              pagamenti. Nessuna scrittura DB viene eseguita da questa pagina.
            </p>
          </div>
          <BGStatusBadge
            tone={loadError ? "danger" : loading ? "warning" : "info"}
          >
            {loadError
              ? "Errore"
              : loading
                ? "Caricamento"
                : `${payments.length} operazioni`}
          </BGStatusBadge>
        </div>

        {loading ? (
          <BGEmptyState
            title="Caricamento pagamenti"
            description="Recupero dello storico pagamenti in corso."
          />
        ) : loadError ? (
          <div className="payments-error" role="alert">
            <strong>Errore caricamento storico</strong>
            <span>{loadError}</span>
            <BGButton onClick={loadPayments} variant="secondary">
              Riprova
            </BGButton>
          </div>
        ) : payments.length === 0 ? (
          <BGEmptyState
            title="Nessun pagamento caricato"
            description="Quando i flussi ufficiali registrano pagamenti, lo storico consultivo comparirà qui."
          />
        ) : (
          <BGDataTable minWidth={1180} className="payments-table-wrap">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Metodo</th>
                <th>Descrizione</th>
                <th>Ricevuta</th>
                <th className="bg-table-align-right">Importo</th>
                <th>Stato</th>
                <th className="bg-table-align-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const name = customerName(payment);

                return (
                  <tr key={payment.id}>
                    <td>
                      {formatDateTime(payment.paid_at || payment.created_at)}
                    </td>
                    <td>{name || "N/D"}</td>
                    <td>
                      <BGStatusBadge tone="info">
                        {formatPaymentType(payment.payment_type)}
                      </BGStatusBadge>
                    </td>
                    <td>{formatPaymentMethod(payment)}</td>
                    <td>
                      <div className="payments-description">
                        {payment.description || "-"}
                      </div>
                    </td>
                    <td>
                      <span className="payments-receipt-reference">
                        Solo da scheda cliente
                      </span>
                    </td>
                    <td className="bg-table-align-right payments-amount">
                      {formatMoney(payment.amount)}
                    </td>
                    <td>
                      <BGStatusBadge tone={statusTone(payment.status)}>
                        {payment.status || "paid"}
                      </BGStatusBadge>
                    </td>
                    <td>
                      <div className="payments-actions">
                        {payment.customer_id ? (
                          <BGActionLink
                            href={`/customers/${payment.customer_id}`}
                            variant="secondary"
                          >
                            Apri cliente
                          </BGActionLink>
                        ) : (
                          <span className="payments-no-action">
                            Cliente non collegato
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </BGDataTable>
        )}
      </BGCard>

      <style jsx>{`
        .payments-page {
          color: #ffffff;
        }

        .payments-readonly-alert {
          margin-bottom: 22px;
        }

        .payments-alert-content,
        .payments-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .payments-alert-content h2,
        .payments-section-header h2 {
          margin: 6px 0 8px;
          color: #ffffff;
          font-size: 24px;
          font-weight: 900;
        }

        .payments-alert-content p,
        .payments-section-header p {
          margin: 0;
          max-width: 860px;
          color: rgba(255, 255, 255, 0.72);
          line-height: 1.55;
        }

        .payments-kpi-grid {
          margin: 22px 0;
        }

        .payments-history-card {
          overflow: hidden;
        }

        .payments-section-header {
          margin-bottom: 20px;
        }

        .payments-description {
          max-width: 320px;
          color: rgba(255, 255, 255, 0.82);
          line-height: 1.45;
        }

        .payments-amount {
          color: #ffffff;
          font-weight: 900;
          white-space: nowrap;
        }

        .payments-actions {
          display: flex;
          justify-content: flex-end;
        }

        .payments-receipt-reference,
        .payments-no-action {
          color: rgba(255, 255, 255, 0.52);
          font-size: 12px;
          font-weight: 800;
        }

        .payments-error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 18px;
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 20px;
          background: rgba(127, 29, 29, 0.24);
          color: #ffffff;
        }

        .payments-error span {
          color: rgba(255, 255, 255, 0.72);
        }

        @media (max-width: 860px) {
          .payments-alert-content,
          .payments-section-header,
          .payments-error {
            align-items: flex-start;
            flex-direction: column;
          }

          .payments-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
