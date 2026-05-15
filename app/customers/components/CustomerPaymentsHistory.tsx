"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Payment = {
  id: string;
  customer_id: string;
  branch_id?: string | null;
  type: string;
  description?: string | null;
  amount: number;
  payment_method?: string | null;
  status?: string | null;
  paid_at?: string | null;
  created_at: string;
};

type Props = {
  customerId: string;
};

export default function CustomerPaymentsHistory({ customerId }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function loadPayments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customer_payments")
      .select("*")
      .eq("customer_id", customerId)
      .order("paid_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Errore pagamenti:", error);
      setPayments([]);
    } else {
      setPayments(data || []);
    }

    setLoading(false);
  }

  const totalPaid = useMemo(() => {
    return payments
      .filter((p) => p.status !== "cancelled")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  function formatDate(value?: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString("it-IT");
  }

  function formatMethod(method?: string | null) {
    switch (method) {
      case "cash":
        return "Contanti";
      case "card":
        return "Carta";
      case "bank_transfer":
        return "Bonifico";
      case "klarna":
        return "Klarna";
      case "scalapay":
        return "Scalapay";
      default:
        return method || "-";
    }
  }

  function formatType(type?: string | null) {
    switch (type) {
      case "membership":
        return "Quota associativa";
      case "subscription":
        return "Abbonamento";
      case "product":
        return "Prodotto";
      case "service":
        return "Servizio";
      default:
        return "Generico";
    }
  }

  function statusClass(status?: string | null) {
    switch (status) {
      case "paid":
        return "paid";
      case "pending":
        return "pending";
      case "cancelled":
        return "cancelled";
      default:
        return "paid";
    }
  }

  function statusLabel(status?: string | null) {
    switch (status) {
      case "paid":
        return "Pagato";
      case "pending":
        return "In sospeso";
      case "cancelled":
        return "Annullato";
      default:
        return "Pagato";
    }
  }

  return (
    <div className="payments-card">
      <style jsx>{`
        .payments-card {
          background: linear-gradient(135deg, #141414, #080808);
          border: 1px solid #262626;
          border-radius: 26px;
          padding: 24px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 22px;
        }

        h3 {
          margin: 0;
          color: #ffffff;
          font-size: 22px;
          font-weight: 950;
        }

        .subtitle {
          margin-top: 6px;
          color: #a3a3a3;
          font-size: 14px;
        }

        .total-box {
          min-width: 180px;
          background: #080808;
          border: 1px solid #262626;
          border-radius: 20px;
          padding: 16px;
          text-align: right;
        }

        .total-label {
          color: #737373;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }

        .total-value {
          color: #4ade80;
          font-size: 24px;
          font-weight: 950;
        }

        .refresh {
          border: 1px solid #303030;
          background: #171717;
          color: white;
          border-radius: 14px;
          padding: 11px 14px;
          font-weight: 900;
          cursor: pointer;
          margin-top: 12px;
          width: 100%;
        }

        .refresh:hover {
          background: #262626;
        }

        .list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .payment-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          background: #080808;
          border: 1px solid #262626;
          border-radius: 18px;
          padding: 16px;
        }

        .payment-main {
          min-width: 0;
        }

        .payment-title {
          color: #ffffff;
          font-size: 15px;
          font-weight: 950;
          margin-bottom: 6px;
        }

        .payment-desc {
          color: #a3a3a3;
          font-size: 13px;
          line-height: 1.45;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          padding: 6px 9px;
          border-radius: 999px;
          background: #171717;
          border: 1px solid #303030;
          color: #a3a3a3;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .payment-side {
          text-align: right;
          min-width: 120px;
        }

        .amount {
          color: #ffffff;
          font-size: 20px;
          font-weight: 950;
          margin-bottom: 8px;
        }

        .status {
          display: inline-flex;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .paid {
          color: #4ade80;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.32);
        }

        .pending {
          color: #facc15;
          background: rgba(250, 204, 21, 0.12);
          border: 1px solid rgba(250, 204, 21, 0.32);
        }

        .cancelled {
          color: #fb7185;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.32);
        }

        .empty,
        .loading {
          color: #737373;
          font-size: 14px;
          padding: 10px 0;
        }

        @media (max-width: 800px) {
          .header,
          .payment-row {
            grid-template-columns: 1fr;
            flex-direction: column;
          }

          .total-box,
          .payment-side {
            text-align: left;
          }
        }
      `}</style>

      <div className="header">
        <div>
          <h3>Storico pagamenti</h3>
          <div className="subtitle">
            Incassi, rinnovi e movimenti economici del cliente
          </div>
        </div>

        <div className="total-box">
          <div className="total-label">Totale pagato</div>
          <div className="total-value">€ {totalPaid.toFixed(2)}</div>
          <button className="refresh" onClick={loadPayments}>
            Aggiorna
          </button>
        </div>
      </div>

      {loading && <div className="loading">Caricamento pagamenti...</div>}

      {!loading && payments.length === 0 && (
        <div className="empty">Nessun pagamento registrato.</div>
      )}

      {!loading && payments.length > 0 && (
        <div className="list">
          {payments.map((payment) => (
            <div className="payment-row" key={payment.id}>
              <div className="payment-main">
                <div className="payment-title">
                  {formatType(payment.type)}
                </div>

                <div className="payment-desc">
                  {payment.description || "Pagamento registrato"}
                </div>

                <div className="meta">
                  <span className="pill">
                    {formatMethod(payment.payment_method)}
                  </span>

                  <span className="pill">
                    {formatDate(payment.paid_at)}
                  </span>
                </div>
              </div>

              <div className="payment-side">
                <div className="amount">
                  € {Number(payment.amount || 0).toFixed(2)}
                </div>

                <div className={`status ${statusClass(payment.status)}`}>
                  {statusLabel(payment.status)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}