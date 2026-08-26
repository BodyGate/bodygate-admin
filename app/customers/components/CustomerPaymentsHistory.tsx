"use client";

import { useEffect, useMemo, useState } from "react";

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
  updated_at?: string | null;
  correction_reason?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  notes?: string | null;
  receipt_id?: string | null;
  receipt_number?: string | null;
};

type Props = {
  customerId: string;
};

type EditForm = {
  amount: string;
  payment_method: string;
  description: string;
  paid_at: string;
  status: string;
  correction_reason: string;
};

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default function CustomerPaymentsHistory({ customerId }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    amount: "",
    payment_method: "cash",
    description: "",
    paid_at: "",
    status: "paid",
    correction_reason: "",
  });

  const [saving, setSaving] = useState(false);
  const [receiptLinkedBlock, setReceiptLinkedBlock] = useState<any>(null);

  const [cancellingPayment, setCancellingPayment] = useState<Payment | null>(
    null,
  );
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function loadPayments() {
    if (!customerId) return;

    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch(
        `/api/customers/list-payments?customer_id=${encodeURIComponent(customerId)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        console.error("Errore pagamenti:", result);
        setPayments([]);
        setLoadError(result?.error || "Errore caricamento pagamenti.");
        return;
      }

      setPayments((result.payments || []) as Payment[]);
    } catch (error: unknown) {
      console.error("Errore pagamenti:", error);
      setPayments([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante il caricamento.",
      );
    } finally {
      setLoading(false);
    }
  }

  const activePayments = useMemo(
    () => payments.filter((p) => p.status !== "cancelled"),
    [payments],
  );

  const cancelledPayments = useMemo(
    () => payments.filter((p) => p.status === "cancelled"),
    [payments],
  );

  const totalPaid = useMemo(() => {
    return activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [activePayments]);

  const cancelledTotal = useMemo(() => {
    return cancelledPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [cancelledPayments]);

  function openEdit(payment: Payment) {
    setEditingPayment(payment);
    setEditForm({
      amount: String(Number(payment.amount || 0)),
      payment_method: payment.payment_method || "cash",
      description: payment.description || "",
      paid_at: toLocalDateTimeInput(payment.paid_at || payment.created_at),
      status: payment.status || "paid",
      correction_reason: "",
    });
  }

  function closeEdit() {
    setEditingPayment(null);
    setSaving(false);
    setEditForm({
      amount: "",
      payment_method: "cash",
      description: "",
      paid_at: "",
      status: "paid",
      correction_reason: "",
    });
  }

  async function saveEdit() {
    if (!editingPayment) return;

    const amount = Number(editForm.amount);
    if (!amount || amount <= 0) {
      alert("Importo non valido.");
      return;
    }

    if (!editForm.correction_reason.trim()) {
      alert("Inserisci il motivo della rettifica.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/customers/update-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_id: editingPayment.id,
          customer_id: customerId,
          amount,
          payment_method: editForm.payment_method,
          description: editForm.description,
          paid_at: editForm.paid_at
            ? new Date(editForm.paid_at).toISOString()
            : null,
          status: editForm.status,
          correction_reason: editForm.correction_reason,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        console.error("update-payment error", result);
        if (
          response.status === 409 &&
          result?.code === "LINKED_RECEIPT_PAYMENT_REQUIRES_CORRECTION"
        ) {
          setReceiptLinkedBlock({
            payment: editingPayment,
            receipt: result.receipt,
          });
          return;
        }
        alert(
          result?.error ||
            result?.detail?.message ||
            "Errore modifica pagamento.",
        );
        return;
      }

      closeEdit();
      await loadPayments();
      alert("Pagamento aggiornato correttamente.");
    } catch (error: unknown) {
      console.error("saveEdit failed", error);
      alert(error instanceof Error ? error.message : "Errore imprevisto.");
    } finally {
      setSaving(false);
    }
  }

  function openCancel(payment: Payment) {
    setCancellingPayment(payment);
    setCancelReason("");
  }

  async function confirmCancel() {
    if (!cancellingPayment) return;

    if (!cancelReason.trim()) {
      alert("Inserisci il motivo dell'annullamento.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/customers/cancel-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_id: cancellingPayment.id,
          customer_id: customerId,
          cancellation_reason: cancelReason,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        console.error("cancel-payment error", result);
        alert(
          result?.error ||
            result?.detail?.message ||
            "Errore annullamento pagamento.",
        );
        return;
      }

      setCancellingPayment(null);
      setCancelReason("");
      await loadPayments();
      alert("Pagamento annullato correttamente.");
    } catch (error: unknown) {
      console.error("confirmCancel failed", error);
      alert(error instanceof Error ? error.message : "Errore imprevisto.");
    } finally {
      setSaving(false);
    }
  }

  function formatDate(value?: string | null) {
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
      case "other":
        return "Altro";
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
      case "extra":
        return "Extra";
      default:
        return type || "-";
    }
  }

  function formatMoney(value: number) {
    return Number(value || 0).toLocaleString("it-IT", {
      style: "currency",
      currency: "EUR",
    });
  }

  function openReceipt(payment: Payment) {
    if (!payment.receipt_id) {
      alert("Nessuna ricevuta collegata a questo pagamento.");
      return;
    }

    window.open(
      `/customers/${customerId}/receipt/${payment.receipt_id}`,
      "_blank",
    );
  }

  return (
    <div className="payments-card">
      <style jsx>{`
        .payments-card {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(
              circle at top left,
              rgba(91, 61, 245, 0.16),
              transparent 34%
            ),
            linear-gradient(180deg, rgba(20, 20, 20, 0.98), rgba(9, 9, 9, 0.98));
          border: 1px solid rgba(21, 22, 28, 0.1);
          border-radius: 26px;
          padding: 24px;
          color: white;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
        }

        .payments-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            90deg,
            rgba(91, 61, 245, 0.16),
            transparent 28%,
            transparent
          );
          opacity: 0.28;
        }

        .payments-card > * {
          position: relative;
          z-index: 1;
        }

        .payments-header {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .eyebrow {
          color: #f87171;
          font-weight: 950;
          letter-spacing: 2.4px;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        h2 {
          margin: 0;
          font-size: 28px;
          font-weight: 950;
          letter-spacing: -0.8px;
        }

        .subtitle {
          color: #cbd5e1;
          margin-top: 7px;
          font-size: 14px;
          line-height: 1.45;
        }

        .totals {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .total-box {
          border: 1px solid rgba(21, 22, 28, 0.1);
          background: rgba(0, 0, 0, 0.36);
          border-radius: 18px;
          padding: 14px 16px;
          min-width: 155px;
        }

        .total-label {
          color: #94a3b8;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          margin-bottom: 6px;
          font-weight: 950;
        }

        .total-value {
          font-size: 21px;
          font-weight: 950;
          letter-spacing: -0.5px;
        }

        .tools-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .count-pill {
          border: 1px solid rgba(21, 22, 28, 0.1);
          background: rgba(255, 255, 255, 0.05);
          border-radius: 999px;
          padding: 9px 12px;
          color: #d4d4d4;
          font-size: 12px;
          font-weight: 900;
        }

        .payment-row {
          border: 1px solid rgba(21, 22, 28, 0.1);
          background: rgba(8, 8, 8, 0.78);
          border-radius: 20px;
          padding: 17px;
          margin-top: 12px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(130px, auto);
          gap: 16px;
          align-items: start;
          min-width: 0;
        }

        .payment-row.cancelled {
          opacity: 0.72;
          border-color: rgba(91, 61, 245, 0.28);
          background: rgba(91, 61, 245, 0.06);
        }

        .payment-title-line {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
        }

        .payment-title {
          font-weight: 950;
          font-size: 16px;
          min-width: 0;
          overflow-wrap: anywhere;
          line-height: 1.25;
        }

        .payment-description {
          color: #a3a3a3;
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .payment-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .pill {
          border: 1px solid rgba(21, 22, 28, 0.1);
          background: rgba(255, 255, 255, 0.04);
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          color: #d4d4d4;
          font-weight: 850;
          max-width: 100%;
          overflow-wrap: anywhere;
          line-height: 1.25;
        }

        .pill.good {
          color: #86efac;
          border-color: rgba(34, 197, 94, 0.28);
          background: rgba(34, 197, 94, 0.1);
        }

        .pill.warning {
          color: #fde68a;
          border-color: rgba(245, 158, 11, 0.3);
          background: rgba(245, 158, 11, 0.1);
        }

        .pill.cancelled {
          color: #fca5a5;
          border-color: rgba(91, 61, 245, 0.35);
          background: rgba(91, 61, 245, 0.1);
        }

        .payment-side {
          text-align: right;
          display: grid;
          gap: 11px;
          justify-items: end;
          min-width: 0;
        }

        .amount {
          font-size: 26px;
          font-weight: 950;
          color: #ffffff;
          letter-spacing: -0.8px;
        }

        .amount.cancelled {
          color: #fca5a5;
          text-decoration: line-through;
        }

        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        button,
        select,
        input,
        textarea {
          border-radius: 14px;
          border: 1px solid #303030;
          padding: 12px 13px;
          background: #050505;
          color: #ffffff;
          outline: none;
          font-size: 14px;
          font-family: inherit;
        }

        button {
          background: #5b3df5;
          border: none;
          font-weight: 950;
          cursor: pointer;
          transition: 0.18s ease;
        }

        button:hover:not(:disabled) {
          transform: translateY(-1px);
          opacity: 0.94;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .secondary {
          background: #ffffff;
          color: #000000;
        }

        .ghost {
          background: #101010;
          color: #ffffff;
          border: 1px solid #303030;
        }

        .danger {
          background: #7f1d1d;
        }

        .empty-state,
        .error-state {
          border: 1px dashed rgba(21, 22, 28, 0.1);
          background: rgba(255, 255, 255, 0.035);
          border-radius: 20px;
          padding: 22px;
          color: #94a3b8;
          line-height: 1.55;
        }

        .error-state {
          color: #fecaca;
          border-color: rgba(91, 61, 245, 0.26);
          background: rgba(91, 61, 245, 0.08);
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.78);
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 18px;
          backdrop-filter: blur(8px);
        }

        .modal {
          width: min(740px, 100%);
          background: linear-gradient(180deg, #151515, #090909);
          border: 1px solid rgba(21, 22, 28, 0.1);
          border-radius: 26px;
          padding: 24px;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.64);
        }

        .modal h3 {
          margin: 0 0 14px;
          font-size: 24px;
          letter-spacing: -0.5px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 7px;
        }

        .field label {
          color: #a3a3a3;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .full {
          grid-column: 1 / -1;
        }

        textarea {
          min-height: 92px;
          resize: vertical;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 17px;
          flex-wrap: wrap;
        }

        .receipt-linked-panel {
          border: 1px solid rgba(245, 158, 11, 0.42);
          background: linear-gradient(
            180deg,
            rgba(120, 53, 15, 0.92),
            rgba(69, 26, 3, 0.92)
          );
          color: #fef3c7;
          border-radius: 22px;
          padding: 18px;
          margin-bottom: 16px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.32);
        }

        .receipt-linked-panel h3 {
          margin: 0 0 8px;
          font-size: 20px;
        }

        .receipt-linked-panel p {
          margin: 0 0 14px;
          color: #fde68a;
          line-height: 1.5;
        }

        .warning-box {
          border: 1px solid rgba(91, 61, 245, 0.28);
          background: rgba(91, 61, 245, 0.08);
          color: #fecaca;
          border-radius: 17px;
          padding: 13px;
          line-height: 1.45;
          font-size: 13px;
          margin-bottom: 15px;
        }

        @media (max-width: 760px) {
          .payments-header,
          .payment-row,
          .tools-row {
            grid-template-columns: 1fr;
            display: grid;
          }

          .payment-side {
            text-align: left;
            justify-items: start;
          }

          .actions {
            justify-content: flex-start;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          h2 {
            font-size: 24px;
          }
        }
      `}</style>

      <div className="payments-header">
        <div>
          <div className="eyebrow">Area amministrativa</div>
          <h2>Pagamenti cliente</h2>
          <div className="subtitle">
            Storico reale da customer_payments, rettifiche controllate,
            annullamenti tracciati e ricevute.
          </div>
        </div>

        <div className="totals">
          <div className="total-box">
            <div className="total-label">Totale valido</div>
            <div className="total-value">{formatMoney(totalPaid)}</div>
          </div>

          <div className="total-box">
            <div className="total-label">Pagamenti</div>
            <div className="total-value">{activePayments.length}</div>
          </div>

          {cancelledPayments.length > 0 ? (
            <div className="total-box">
              <div className="total-label">Annullati</div>
              <div className="total-value">{formatMoney(cancelledTotal)}</div>
            </div>
          ) : null}
        </div>
      </div>

      {receiptLinkedBlock ? (
        <div className="receipt-linked-panel">
          <h3>Pagamento collegato a ricevuta</h3>
          <p>
            Questo pagamento è associato alla ricevuta{" "}
            {receiptLinkedBlock.receipt?.receipt_number || "collegata"}.
            L’importo non può essere modificato direttamente perché creerebbe un
            disallineamento documentale.
          </p>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button
              type="button"
              className="ghost"
              onClick={() => setReceiptLinkedBlock(null)}
            >
              Chiudi
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                window.open(
                  `/customers/${customerId}/receipt/${receiptLinkedBlock.receipt?.id}`,
                  "_blank",
                )
              }
            >
              Apri ricevuta
            </button>
            <button
              type="button"
              onClick={() =>
                receiptLinkedBlock.payment &&
                openEdit(receiptLinkedBlock.payment)
              }
            >
              Visualizza dettagli pagamento
            </button>
          </div>
        </div>
      ) : null}

      <div className="tools-row">
        <span className="count-pill">
          {payments.length} movimenti trovati per questo cliente
        </span>

        <button
          type="button"
          className="ghost"
          onClick={loadPayments}
          disabled={loading}
        >
          {loading ? "Aggiorno..." : "Aggiorna"}
        </button>
      </div>

      {loading ? (
        <div className="empty-state">Caricamento pagamenti...</div>
      ) : loadError ? (
        <div className="error-state">
          {loadError}
          <br />
          Se il pagamento esiste in Supabase ma non compare qui, controlla la
          route server
          <strong> /api/customers/list-payments</strong>.
        </div>
      ) : payments.length === 0 ? (
        <div className="empty-state">
          Nessun pagamento registrato per questo cliente.
          <br />I rinnovi futuri devono sempre generare anche un record in
          customer_payments.
        </div>
      ) : (
        payments.map((payment) => {
          const cancelled = payment.status === "cancelled";

          return (
            <div
              className={`payment-row ${cancelled ? "cancelled" : ""}`}
              key={payment.id}
            >
              <div>
                <div className="payment-title-line">
                  <div className="payment-title">
                    {formatType(payment.type)}
                  </div>

                  <span className={`pill ${cancelled ? "cancelled" : "good"}`}>
                    {cancelled ? "Annullato" : payment.status || "Pagato"}
                  </span>

                  {payment.receipt_number ? (
                    <span className="pill warning">
                      Ricevuta {payment.receipt_number}
                    </span>
                  ) : null}
                </div>

                <div className="payment-description">
                  {payment.description || "Pagamento cliente"}
                </div>

                <div className="payment-meta">
                  <span className="pill">
                    {formatMethod(payment.payment_method)}
                  </span>
                  <span className="pill">
                    {formatDate(payment.paid_at || payment.created_at)}
                  </span>
                  <span className="pill">ID {payment.id.slice(0, 8)}</span>
                </div>

                {payment.correction_reason ? (
                  <div className="payment-description">
                    <strong>Rettifica:</strong> {payment.correction_reason}
                  </div>
                ) : null}

                {payment.cancellation_reason ? (
                  <div className="payment-description">
                    <strong>Motivo annullamento:</strong>{" "}
                    {payment.cancellation_reason}
                  </div>
                ) : null}
              </div>

              <div className="payment-side">
                <div className={`amount ${cancelled ? "cancelled" : ""}`}>
                  {formatMoney(payment.amount)}
                </div>

                <div className="actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => openEdit(payment)}
                    disabled={cancelled}
                  >
                    Modifica
                  </button>

                  <button
                    type="button"
                    className="ghost"
                    onClick={() => openReceipt(payment)}
                  >
                    Ricevuta
                  </button>

                  <button
                    type="button"
                    className="danger"
                    onClick={() => openCancel(payment)}
                    disabled={cancelled}
                  >
                    Annulla
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {editingPayment ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Modifica pagamento</h3>

            <div className="warning-box">
              La modifica è una rettifica amministrativa. Inserisci sempre un
              motivo chiaro: resterà visibile nello storico cliente.
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Importo</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                />
              </div>

              <div className="field">
                <label>Metodo</label>
                <select
                  value={editForm.payment_method}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      payment_method: e.target.value,
                    }))
                  }
                >
                  <option value="cash">Contanti</option>
                  <option value="card">Carta</option>
                  <option value="bank_transfer">Bonifico</option>
                  <option value="klarna">Klarna</option>
                  <option value="scalapay">Scalapay</option>
                  <option value="other">Altro</option>
                </select>
              </div>

              <div className="field">
                <label>Data pagamento</label>
                <input
                  type="datetime-local"
                  value={editForm.paid_at}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      paid_at: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="field">
                <label>Stato</label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                >
                  <option value="paid">Pagato</option>
                  <option value="pending">In sospeso</option>
                </select>
              </div>

              <div className="field full">
                <label>Descrizione</label>
                <input
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="field full">
                <label>Motivo rettifica obbligatorio</label>
                <textarea
                  value={editForm.correction_reason}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      correction_reason: e.target.value,
                    }))
                  }
                  placeholder="Esempio: importo inserito per errore, metodo pagamento corretto, data errata..."
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="ghost" onClick={closeEdit}>
                Annulla
              </button>
              <button type="button" onClick={saveEdit} disabled={saving}>
                {saving ? "Salvataggio..." : "Salva rettifica"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancellingPayment ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Annulla pagamento</h3>

            <div className="warning-box">
              Il pagamento non verrà cancellato. Verrà marcato come annullato e
              resterà nello storico.
            </div>

            <div className="field">
              <label>Motivo annullamento obbligatorio</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Esempio: pagamento registrato due volte, cliente rimborsato..."
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setCancellingPayment(null)}
              >
                Chiudi
              </button>
              <button
                type="button"
                className="danger"
                onClick={confirmCancel}
                disabled={saving}
              >
                {saving ? "Annullamento..." : "Conferma annullamento"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
