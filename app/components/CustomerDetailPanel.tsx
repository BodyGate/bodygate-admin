"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

import CustomerDocumentsPanel from "./CustomerDocumentsPanel";
import CustomerPaymentsPanel from "./CustomerPaymentsPanel";
import CustomerMedicalCertificates from "./CustomerMedicalCertificates";

type Customer = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  phone: string | null;
  badge_code: string | null;
  subscription_status: string | null;
  subscription_expiry: string | null;
  active: boolean;
  created_at: string;
};

type AccessLog = {
  id: string;
  created_at: string;
  badge_code: string | null;
  controller_code: string | null;
  allowed: boolean;
  reason: string | null;
};

export default function CustomerDetailPanel({
  customerId,
}: {
  customerId: string;
}) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [badgeInput, setBadgeInput] = useState("");
  const [message, setMessage] = useState("");

  function getCustomerName(customer: Customer) {
    const fullName = customer.full_name?.trim();

    const firstLast = `${customer.first_name || ""} ${
      customer.last_name || ""
    }`.trim();

    return fullName || firstLast || "Cliente senza nome";
  }

  async function loadCustomer() {
    setLoading(true);

    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    const { data: logsData } = await supabase
      .from("access_logs")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(10);

    const loadedCustomer = customerData as Customer;

    setCustomer(loadedCustomer);
    setBadgeInput(loadedCustomer?.badge_code || "");
    setLogs((logsData || []) as AccessLog[]);
    setLoading(false);
  }

  async function toggleAccess() {
    if (!customer) return;

    setSaving(true);
    setMessage("");

    const newActiveStatus = !customer.active;

    const { error } = await supabase
      .from("customers")
      .update({ active: newActiveStatus })
      .eq("id", customer.id);

    if (!error) {
      setCustomer({ ...customer, active: newActiveStatus });

      setMessage(
        newActiveStatus
          ? "Accesso cliente sbloccato correttamente."
          : "Accesso cliente bloccato correttamente."
      );
    } else {
      setMessage("Errore durante l'aggiornamento dello stato accesso.");
    }

    setSaving(false);
  }

  async function saveBadge() {
    if (!customer) return;

    const cleanBadge = badgeInput.trim();

    if (!cleanBadge) {
      setMessage("Inserisci un codice badge valido.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("customers")
      .update({ badge_code: cleanBadge })
      .eq("id", customer.id);

    if (!error) {
      setCustomer({ ...customer, badge_code: cleanBadge });
      setMessage("Badge associato correttamente.");
    } else {
      setMessage("Errore durante l'associazione del badge.");
    }

    setSaving(false);
  }

  async function removeBadge() {
    if (!customer) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("customers")
      .update({ badge_code: null })
      .eq("id", customer.id);

    if (!error) {
      setCustomer({ ...customer, badge_code: null });
      setBadgeInput("");
      setMessage("Badge rimosso correttamente.");
    } else {
      setMessage("Errore durante la rimozione del badge.");
    }

    setSaving(false);
  }

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  if (loading) {
    return <div style={cardStyle}>Caricamento scheda cliente...</div>;
  }

  if (!customer) {
    return <div style={cardStyle}>Cliente non trovato.</div>;
  }

  const customerName = getCustomerName(customer);

  const statusLabel = !customer.active
    ? "BLOCCATO"
    : customer.subscription_status === "expired"
    ? "SCADUTO"
    : "ATTIVO";

  const statusColor = !customer.active
    ? "#ef4444"
    : customer.subscription_status === "expired"
    ? "#f59e0b"
    : "#22c55e";

  return (
    <div style={{ display: "grid", gap: "22px" }}>
      <div style={heroStyle}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <div style={avatarStyle}>
            {customerName.charAt(0).toUpperCase() || "?"}
          </div>

          <div>
            <h1 style={{ margin: 0, fontSize: "42px" }}>{customerName}</h1>

            <div style={{ marginTop: "8px", color: "var(--muted)" }}>
              Scheda cliente · ID {customer.id.slice(0, 8)}
            </div>
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${statusColor}`,
            color: statusColor,
            borderRadius: "999px",
            padding: "10px 16px",
            fontWeight: "bold",
            background: `${statusColor}22`,
          }}
        >
          {statusLabel}
        </div>
      </div>

      <div style={gridStyle}>
        <InfoCard title="Email" value={customer.email || "-"} />
        <InfoCard title="Telefono" value={customer.phone || "-"} />
        <InfoCard title="Badge attuale" value={customer.badge_code || "-"} />
        <InfoCard
          title="Scadenza abbonamento"
          value={
            customer.subscription_expiry
              ? new Date(customer.subscription_expiry).toLocaleDateString(
                  "it-IT"
                )
              : "-"
          }
        />
      </div>

      <div style={cardStyle}>
        <h2 style={sectionTitle}>Gestione badge</h2>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <input
            value={badgeInput}
            onChange={(e) => setBadgeInput(e.target.value)}
            placeholder="Inserisci codice badge"
            style={inputStyle}
          />

          <button onClick={saveBadge} disabled={saving} style={primaryButton}>
            {saving ? "Salvataggio..." : "Salva badge"}
          </button>

          <button
            onClick={removeBadge}
            disabled={saving}
            style={secondaryButton}
          >
            Rimuovi badge
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={sectionTitle}>Azioni rapide</h2>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <Link href={`/customers/${customer.id}/edit`} style={primaryLinkButton}>
            Modifica cliente
          </Link>

          <Link
            href={`/customers/${customer.id}/contract`}
            style={primaryLinkButton}
          >
            Stampa contratto
          </Link>

          <button style={secondaryButton}>Genera QR virtuale</button>

          <button
            onClick={toggleAccess}
            disabled={saving}
            style={customer.active ? dangerButton : successButton}
          >
            {saving
              ? "Salvataggio..."
              : customer.active
              ? "Blocca accesso"
              : "Sblocca accesso"}
          </button>
        </div>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <CustomerPaymentsPanel customerId={customer.id} />

      <CustomerDocumentsPanel customerId={customer.id} />
      <CustomerMedicalCertificates customerId={customer.id} />

      <div style={cardStyle}>
        <h2 style={sectionTitle}>Ultimi accessi</h2>

        {logs.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>
            Nessun accesso registrato.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {logs.map((log) => (
              <div key={log.id} style={logRowStyle}>
                <div>
                  <div style={{ fontWeight: "bold" }}>
                    {new Date(log.created_at).toLocaleString("it-IT")}
                  </div>

                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "13px",
                    }}
                  >
                    Badge: {log.badge_code || "-"} · Controller:{" "}
                    {log.controller_code || "-"}
                  </div>
                </div>

                <div
                  style={{
                    color: log.allowed ? "#22c55e" : "#ef4444",
                    fontWeight: "bold",
                  }}
                >
                  {log.allowed ? "CONSENTITO" : "NEGATO"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          color: "var(--muted)",
          fontSize: "13px",
          marginBottom: "10px",
        }}
      >
        {title.toUpperCase()}
      </div>

      <div style={{ fontSize: "22px", fontWeight: "bold" }}>{value}</div>
    </div>
  );
}

const heroStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "26px",
  padding: "28px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  flexWrap: "wrap",
};

const avatarStyle: React.CSSProperties = {
  width: "78px",
  height: "78px",
  borderRadius: "24px",
  background: "var(--accent)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "34px",
  fontWeight: "bold",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: "16px",
};

const cardStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "22px",
  padding: "22px",
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 18px 0",
  fontSize: "22px",
};

const inputStyle: React.CSSProperties = {
  flex: "1",
  minWidth: "240px",
  background: "var(--bg-soft)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "14px 16px",
  outline: "none",
  fontWeight: 600,
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

const primaryLinkButton: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  borderRadius: "14px",
  padding: "14px 18px",
  fontWeight: "bold",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const secondaryButton: React.CSSProperties = {
  background: "var(--bg-soft)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "14px 18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  background: "rgba(239,68,68,0.12)",
  color: "#ef4444",
  border: "1px solid rgba(239,68,68,0.35)",
  borderRadius: "14px",
  padding: "14px 18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const successButton: React.CSSProperties = {
  background: "rgba(34,197,94,0.12)",
  color: "#22c55e",
  border: "1px solid rgba(34,197,94,0.35)",
  borderRadius: "14px",
  padding: "14px 18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const messageStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  padding: "16px",
  fontWeight: "bold",
};

const logRowStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  padding: "16px",
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "center",
};