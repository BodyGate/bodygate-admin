"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Props = {
  customerId: string;
};

type Payment = {
  id: string;
  amount: number;
  payment_method: string | null;
  method?: string | null;
  description: string | null;
  created_at: string;
  subscription_days: number | null;
};

export default function CustomerPaymentsPanel({ customerId }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState("50");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [description, setDescription] = useState("Abbonamento palestra");
  const [subscriptionDays, setSubscriptionDays] = useState("30");

  const [saving, setSaving] = useState(false);
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lastReceiptUrl, setLastReceiptUrl] = useState<string | null>(null);

  async function loadPayments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore caricamento pagamenti:", error);
      setPayments([]);
      setMessage("Errore caricamento pagamenti: " + error.message);
    } else {
      setPayments((data || []) as Payment[]);
    }

    setLoading(false);
  }

  function translatePaymentMethod(method: string | null | undefined) {
    if (method === "cash") return "Contanti";
    if (method === "card") return "Carta";
    if (method === "bank") return "Bonifico";
    return method || "-";
  }

  async function createPayment() {
    setSaving(true);
    setMessage("");
    setLastReceiptUrl(null);

    const parsedAmount = Number(amount);
    const parsedDays = Number(subscriptionDays);

    if (!parsedAmount || parsedAmount <= 0) {
      setMessage("Importo non valido.");
      setSaving(false);
      return;
    }

    if (!parsedDays || parsedDays <= 0) {
      setMessage("Numero giorni non valido.");
      setSaving(false);
      return;
    }

    const { error: paymentError } = await supabase.from("payments").insert({
      customer_id: customerId,
      amount: parsedAmount,
      payment_method: paymentMethod,
      method: paymentMethod,
      description,
      subscription_days: parsedDays,
      created_at: new Date().toISOString(),
    });

    if (paymentError) {
      console.error("Errore pagamento:", paymentError);

      setMessage("Errore creazione pagamento: " + paymentError.message);
      setSaving(false);
      return;
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("subscription_expiry")
      .eq("id", customerId)
      .single();

    if (customerError) {
      console.error("Errore cliente:", customerError);
      setMessage(
        "Pagamento registrato, ma errore aggiornamento abbonamento: " +
          customerError.message
      );
      await loadPayments();
      setSaving(false);
      return;
    }

    const now = new Date();

    const currentExpiry = customer?.subscription_expiry
      ? new Date(customer.subscription_expiry)
      : now;

    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate);

    newExpiry.setDate(newExpiry.getDate() + parsedDays);

    const { error: updateError } = await supabase
      .from("customers")
      .update({
        subscription_status: "active",
        active: true,
        subscription_expiry: newExpiry.toISOString(),
      })
      .eq("id", customerId);

    if (updateError) {
      console.error("Errore aggiornamento abbonamento:", updateError);
      setMessage(
        "Pagamento registrato, ma errore aggiornamento abbonamento: " +
          updateError.message
      );
    } else {
      setMessage("Pagamento registrato e abbonamento aggiornato.");
    }

    setAmount("50");
    setDescription("Abbonamento palestra");
    setSubscriptionDays("30");

    await loadPayments();

    setSaving(false);
  }

  async function generateReceipt(paymentId: string) {
    setReceiptLoadingId(paymentId);
    setMessage("");
    setLastReceiptUrl(null);

    try {
      const response = await fetch(
        `/api/customers/${customerId}/payments/${paymentId}/receipt/create`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (result.ok) {
        setMessage("Ricevuta PDF generata e salvata nei documenti.");
        setLastReceiptUrl(result.file_url || null);
        await loadPayments();
      } else {
        setMessage(result.message || "Errore generazione ricevuta.");
      }
    } catch {
      setMessage("Errore durante la generazione della ricevuta.");
    }

    setReceiptLoadingId(null);
  }

  useEffect(() => {
    loadPayments();
  }, [customerId]);

  return (
    <div style={panelStyle}>
      <div style={panelTitleStyle}>Pagamenti e rinnovi</div>

      <div style={formGridStyle}>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Importo"
          style={inputStyle}
        />

        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          style={inputStyle}
        >
          <option value="cash">Contanti</option>
          <option value="card">Carta</option>
          <option value="bank">Bonifico</option>
        </select>

        <input
          value={subscriptionDays}
          onChange={(e) => setSubscriptionDays(e.target.value)}
          placeholder="Giorni"
          style={inputStyle}
        />

        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrizione"
          style={inputStyle}
        />
      </div>

      <button onClick={createPayment} disabled={saving} style={primaryButton}>
        {saving ? "Registrazione..." : "Registra pagamento"}
      </button>

      {message && (
        <div style={messageStyle}>
          <span>{message}</span>

          {lastReceiptUrl && (
            <a
              href={lastReceiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={receiptLinkStyle}
            >
              Apri ricevuta PDF
            </a>
          )}
        </div>
      )}

      <div style={{ marginTop: "30px" }}>
        <div style={sectionTitleStyle}>Storico pagamenti</div>

        {loading ? (
          <div style={{ color: "var(--muted)" }}>Caricamento...</div>
        ) : payments.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>
            Nessun pagamento presente.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {payments.map((payment) => {
              const displayMethod =
                payment.payment_method || payment.method || "-";

              return (
                <div key={payment.id} style={paymentCard}>
                  <div>
                    <div style={amountStyle}>
                      € {Number(payment.amount).toFixed(2)}
                    </div>

                    <div style={mutedStyle}>{payment.description || "-"}</div>

                    <div style={smallMutedStyle}>
                      {payment.created_at
                        ? new Date(payment.created_at).toLocaleString("it-IT")
                        : "-"}
                    </div>
                  </div>

                  <div style={rightSideStyle}>
                    <div style={{ fontWeight: "bold" }}>
                      +{payment.subscription_days || 0} giorni
                    </div>

                    <div style={mutedStyle}>
                      {translatePaymentMethod(displayMethod)}
                    </div>

                    <button
                      onClick={() => generateReceipt(payment.id)}
                      disabled={receiptLoadingId === payment.id}
                      style={{
                        ...receiptButtonStyle,
                        opacity: receiptLoadingId === payment.id ? 0.6 : 1,
                      }}
                    >
                      {receiptLoadingId === payment.id
                        ? "Generazione..."
                        : "Genera ricevuta PDF"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "24px",
  padding: "24px",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: "bold",
  marginBottom: "22px",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: "14px",
  marginBottom: "18px",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "14px 16px",
  outline: "none",
};

const primaryButton: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  borderRadius: "14px",
  padding: "14px 18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const messageStyle: React.CSSProperties = {
  marginTop: "16px",
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "14px 16px",
  fontWeight: "bold",
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap",
};

const receiptLinkStyle: React.CSSProperties = {
  color: "white",
  background: "var(--accent)",
  padding: "10px 14px",
  borderRadius: "12px",
  textDecoration: "none",
  fontWeight: "bold",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "bold",
  marginBottom: "16px",
};

const paymentCard: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "18px",
  padding: "18px",
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  alignItems: "center",
  flexWrap: "wrap",
};

const amountStyle: React.CSSProperties = {
  fontWeight: "bold",
  fontSize: "18px",
};

const mutedStyle: React.CSSProperties = {
  marginTop: "6px",
  color: "var(--muted)",
};

const smallMutedStyle: React.CSSProperties = {
  marginTop: "4px",
  color: "var(--muted)",
  fontSize: "13px",
};

const rightSideStyle: React.CSSProperties = {
  textAlign: "right",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "6px",
};

const receiptButtonStyle: React.CSSProperties = {
  marginTop: "8px",
  background: "rgba(239,68,68,0.12)",
  color: "#ef4444",
  border: "1px solid rgba(239,68,68,0.35)",
  borderRadius: "14px",
  padding: "10px 14px",
  fontWeight: "bold",
  cursor: "pointer",
};