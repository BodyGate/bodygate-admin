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
  updated_at?: string | null;
  correction_reason?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  notes?: string | null;
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
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default function CustomerPaymentsHistory({ customerId }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

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

  const [cancellingPayment, setCancellingPayment] = useState<Payment | null>(null);
  const [cancelReason, setCancelReason] = useState("");

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
      .limit(80);

    if (error) {
      console.error("Errore pagamenti:", error);
      setPayments([]);
    } else {
      setPayments((data || []) as Payment[]);
    }

    setLoading(false);
  }

  const totalPaid = useMemo(() => {
    return payments
      .filter((p) => p.status !== "cancelled")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  const cancelledTotal = useMemo(() => {
    return payments
      .filter((p) => p.status === "cancelled")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

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
          paid_at: editForm.paid_at ? new Date(editForm.paid_at).toISOString() : null,
          status: editForm.status,
          correction_reason: editForm.correction_reason,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        console.error("update-payment error", result);
        alert(result?.error || "Errore modifica pagamento.");
        return;
      }

      closeEdit();
      await loadPayments();
      alert("Pagamento aggiornato correttamente.");
    } catch (error: any) {
      console.error("saveEdit failed", error);
      alert(error?.message || "Errore imprevisto.");
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
        alert(result?.error || "Errore annullamento pagamento.");
        return;
      }

      setCancellingPayment(null);
      setCancelReason("");
      await loadPayments();
      alert("Pagamento annullato correttamente.");
    } catch (error: any) {
      console.error("confirmCancel failed", error);
      alert(error?.message || "Errore imprevisto.");
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <div className="payments-card">
      <style jsx>{`
        .payments-card {
          background: linear-gradient(180deg, #141414, #090909);
          border: 1px solid #262626;
          border-radius: 22px;
          padding: 22px;
          color: white;
        }

        .payments-header {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 950;
        }

        .subtitle {
          color: #a3a3a3;
          margin-top: 6px;
          font-size: 13px;
        }

        .totals {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .total-box {
          border: 1px solid #262626;
          background: #050505;
          border-radius: 16px;
          padding: 12px 14px;
          min-width: 150px;
        }

        .total-label {
          color: #737373;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 5px;
          font-weight: 900;
        }

        .total-value {
          font-size: 18px;
          font-weight: 950;
        }

        .payment-row {
          border: 1px solid #262626;
          background: #080808;
          border-radius: 18px;
          padding: 16px;
          margin-top: 12px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: start;
        }

        .payment-row.cancelled {
          opacity: 0.62;
          border-color: rgba(239, 68, 68, 0.24);
          background: rgba(239, 68, 68, 0.05);
        }

        .payment-title {
          font-weight: 950;
          font-size: 15px;
        }

        .payment-description {
          color: #a3a3a3;
          margin-top: 4px;
          font-size: 13px;
          line-height: 1.45;
        }

        .payment-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }

        .pill {
          border: 1px solid #303030;
          background: #050505;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          color: #d4d4d4;
          font-weight: 800;
        }

        .pill.cancelled {
          color: #fca5a5;
          border-color: rgba(239, 68, 68, 0.35);
          background: rgba(239, 68, 68, 0.10);
        }

        .payment-side {
          text-align: right;
          display: grid;
          gap: 10px;
          justify-items: end;
        }

        .amount {
          font-size: 22px;
          font-weight: 950;
          color: #ffffff;
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
          background: #ef4444;
          border: none;
          font-weight: 950;
          cursor: pointer;
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

        .empty {
          color: #737373;
          padding: 14px 0;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.72);
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 18px;
        }

        .modal {
          width: min(720px, 100%);
          background: #101010;
          border: 1px solid #303030;
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
        }

        .modal h3 {
          margin: 0 0 14px;
          font-size: 22px;
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
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .full {
          grid-column: 1 / -1;
        }

        textarea {
          min-height: 90px;
          resize: vertical;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 16px;
          flex-wrap: wrap;
        }

        .warning-box {
          border: 1px solid rgba(239, 68, 68, 0.28);
          background: rgba(239, 68, 68, 0.08);
          color: #fecaca;
          border-radius: 16px;
          padding: 13px;
          line-height: 1.45;
          font-size: 13px;
          margin-bottom: 14px;
        }

        @media (max-width: 760px) {
          .payments-header,
          .payment-row {
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
        }
      `}</style>

      <div className="payments-header">
        <div>
          <h2>Pagamenti cliente</h2>
          <div className="subtitle">
            Storico, rettifiche, annullamenti e ricevute del cliente.
          </div>
        </div>

        <div className="totals">
          <div className="total-box">
            <div className="total-label">Totale valido</div>
            <div className="total-value">{formatMoney(totalPaid)}</div>
          </div>

          {cancelledTotal > 0 ? (
            <div className="total-box">
              <div className="total-label">Annullati</div>
              <div className="total-value">{formatMoney(cancelledTotal)}</div>
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="empty">Caricamento pagamenti...</div>
      ) : payments.length === 0 ? (
        <div className="empty">Nessun pagamento registrato.</div>
      ) : (
        payments.map((payment) => {
          const cancelled = payment.status === "cancelled";

          return (
            <div
              className={`payment-row ${cancelled ? "cancelled" : ""}`}
              key={payment.id}
            >
              <div>
                <div className="payment-title">{formatType(payment.type)}</div>
                <div className="payment-description">
                  {payment.description || "Pagamento cliente"}
                </div>

                <div className="payment-meta">
                  <span className="pill">{formatMethod(payment.payment_method)}</span>
                  <span className="pill">{formatDate(payment.paid_at || payment.created_at)}</span>
                  <span className={`pill ${cancelled ? "cancelled" : ""}`}>
                    {cancelled ? "Annullato" : payment.status || "Pagato"}
                  </span>
                </div>

                {payment.correction_reason ? (
                  <div className="payment-description">
                    Rettifica: {payment.correction_reason}
                  </div>
                ) : null}

                {payment.cancellation_reason ? (
                  <div className="payment-description">
                    Motivo annullamento: {payment.cancellation_reason}
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
              La modifica è una rettifica amministrativa. Inserisci sempre un motivo chiaro.
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
                    setEditForm((prev) => ({ ...prev, payment_method: e.target.value }))
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
                    setEditForm((prev) => ({ ...prev, paid_at: e.target.value }))
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
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
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
              Il pagamento non verrà cancellato, ma marcato come annullato. Inserisci il motivo.
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
