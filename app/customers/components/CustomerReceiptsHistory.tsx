"use client";

import { useEffect, useMemo, useState } from "react";
import { BGButton, BGCard, BGDataTable, BGEmptyState, BGStatusBadge } from "@/components/bodygate-ui";

type Receipt = {
  id: string;
  customer_id: string;
  payment_id?: string | null;
  subscription_id?: string | null;
  receipt_number?: string | null;
  receipt_type?: string | null;
  description?: string | null;
  amount?: number | string | null;
  payment_method?: string | null;
  issued_at?: string | null;
  created_at?: string | null;
  customer_copy_label?: string | null;
  gym_copy_label?: string | null;
};

type Props = {
  customerId: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(value?: number | string | null) {
  const amount = Number(value || 0);

  return amount.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}

function formatMethod(method?: string | null) {
  if (method === "cash") return "Contanti";
  if (method === "pos") return "POS";
  if (method === "bank_transfer") return "Bonifico";
  return method || "-";
}

function formatType(type?: string | null) {
  if (type === "subscription") return "Abbonamento";
  if (type === "onboarding") return "Iscrizione";
  if (type === "membership" || type === "membership_fee") return "Quota";
  return type || "Ricevuta";
}

function receiptUrl(customerId: string, receiptId: string) {
  return `/customers/${customerId}/receipt/${receiptId}`;
}

export default function CustomerReceiptsHistory({ customerId }: Props) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function loadReceipts() {
    if (!customerId) return;

    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch(
        `/api/customers/list-receipts?customer_id=${encodeURIComponent(customerId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        console.error("Errore ricevute:", result);
        setReceipts([]);
        setLoadError(result?.error || "Errore caricamento ricevute.");
        return;
      }

      setReceipts((result.receipts || []) as Receipt[]);
    } catch (error: unknown) {
      console.error("Errore ricevute:", error);
      setReceipts([]);
      setLoadError(error instanceof Error ? error.message : "Errore imprevisto durante il caricamento.");
    } finally {
      setLoading(false);
    }
  }

  const totalReceiptsAmount = useMemo(() => {
    return receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
  }, [receipts]);

  function openReceipt(receipt: Receipt) {
    window.open(receiptUrl(customerId, receipt.id), "_blank", "noopener,noreferrer");
  }

  return (
    <BGCard className="customer-receipts-history" variant="premium">
      <div className="bg-section-header receipts-header">
        <div>
          <div className="bg-eyebrow">Storico fiscale</div>
          <h2>Ricevute</h2>
          <p>
            Tutte le ricevute generate per il cliente, ordinate dalla più recente.
          </p>
        </div>

        <div className="receipts-summary">
          <BGStatusBadge tone={loadError ? "danger" : receipts.length ? "success" : "info"}>
            {loading ? "Caricamento" : `${receipts.length} ricevute`}
          </BGStatusBadge>
          <div className="receipts-total">{formatMoney(totalReceiptsAmount)}</div>
        </div>
      </div>

      {loading ? (
        <BGEmptyState
          title="Caricamento ricevute"
          description="Recupero dello storico ricevute cliente in corso."
        />
      ) : loadError ? (
        <div className="receipts-error" role="alert">
          <strong>Errore caricamento ricevute</strong>
          <span>{loadError}</span>
          <BGButton onClick={loadReceipts} variant="secondary">
            Riprova
          </BGButton>
        </div>
      ) : receipts.length === 0 ? (
        <BGEmptyState
          title="Nessuna ricevuta presente"
          description="Quando i flussi esistenti generano una ricevuta, comparirà in questo storico."
        />
      ) : (
        <BGDataTable minWidth={980}>
          <thead>
            <tr>
              <th>Numero</th>
              <th>Data</th>
              <th>Causale</th>
              <th>Tipo</th>
              <th>Metodo</th>
              <th className="bg-table-align-right">Importo</th>
              <th className="bg-table-align-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <tr key={receipt.id}>
                <td>
                  <span className="bg-table-code">
                    {receipt.receipt_number || `#${receipt.id.slice(0, 8)}`}
                  </span>
                </td>
                <td>{formatDate(receipt.issued_at || receipt.created_at)}</td>
                <td>
                  <div className="receipt-description">
                    {receipt.description || "Ricevuta cliente"}
                  </div>
                </td>
                <td>
                  <BGStatusBadge tone="info">{formatType(receipt.receipt_type)}</BGStatusBadge>
                </td>
                <td>{formatMethod(receipt.payment_method)}</td>
                <td className="bg-table-align-right receipt-amount">
                  {formatMoney(receipt.amount)}
                </td>
                <td>
                  <div className="receipt-actions">
                    <BGButton onClick={() => openReceipt(receipt)} variant="secondary">
                      Visualizza
                    </BGButton>
                    <BGButton onClick={() => openReceipt(receipt)} variant="ghost">
                      Stampa
                    </BGButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </BGDataTable>
      )}

      <style jsx>{`
        .customer-receipts-history {
          position: relative;
          overflow: hidden;
        }

        .customer-receipts-history::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(
            circle at top right,
            rgba(239, 68, 68, 0.16),
            transparent 36%
          );
        }

        .receipts-header,
        .customer-receipts-history :global(.bg-table-wrap),
        .customer-receipts-history :global(.bg-empty),
        .receipts-error {
          position: relative;
          z-index: 1;
        }

        .receipts-header {
          align-items: flex-start;
          margin-bottom: 0;
        }

        .receipts-summary {
          display: grid;
          gap: 10px;
          justify-items: end;
          text-align: right;
        }

        .receipts-total {
          color: #ffffff;
          font-size: 28px;
          font-weight: 950;
          letter-spacing: -0.05em;
        }

        .customer-receipts-history :global(.bg-table-align-right) {
          text-align: right;
        }

        .receipt-description {
          color: #f5f5f5;
          font-weight: 800;
          line-height: 1.35;
          max-width: 340px;
          min-width: 0;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .receipt-amount {
          color: #ffffff;
          font-weight: 950;
          white-space: nowrap;
        }

        .receipt-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
          min-width: 0;
        }

        .receipt-actions :global(.bg-button) {
          min-height: 38px;
          padding: 0 12px;
          border-radius: 13px;
          font-size: 12px;
        }

        .receipts-error {
          display: grid;
          gap: 12px;
          align-items: start;
          justify-items: start;
          border: 1px solid rgba(239, 68, 68, 0.28);
          border-radius: 22px;
          padding: 22px;
          background: rgba(239, 68, 68, 0.08);
          color: #fecaca;
        }

        .receipts-error strong {
          color: #ffffff;
          font-size: 16px;
          font-weight: 950;
        }

        .receipts-error span {
          color: #fecaca;
          line-height: 1.5;
        }

        @media (max-width: 720px) {
          .receipts-header {
            display: grid;
          }

          .receipts-summary {
            justify-items: start;
            text-align: left;
          }

          .receipt-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </BGCard>
  );
}
