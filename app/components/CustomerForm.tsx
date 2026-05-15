"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type CustomerFormProps = {
  mode?: "create" | "edit";
  customer?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    badge_code: string | null;
    subscription_status: string | null;
    subscription_expiry: string | null;
    active: boolean;
  };
};

export default function CustomerForm({
  mode = "create",
  customer,
}: CustomerFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(customer?.full_name || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [badgeCode, setBadgeCode] = useState(customer?.badge_code || "");
  const [subscriptionStatus, setSubscriptionStatus] = useState(
    customer?.subscription_status || "active"
  );
  const [subscriptionExpiry, setSubscriptionExpiry] = useState(
    customer?.subscription_expiry
      ? customer.subscription_expiry.slice(0, 10)
      : ""
  );
  const [active, setActive] = useState(customer?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault();

    if (!fullName.trim()) {
      setMessage("Inserisci il nome del cliente.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      badge_code: badgeCode.trim() || null,
      subscription_status: subscriptionStatus,
      subscription_expiry: subscriptionExpiry
        ? new Date(subscriptionExpiry).toISOString()
        : null,
      active,
    };

    if (mode === "edit" && customer) {
      const { error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", customer.id);

      if (error) {
        setMessage(`Errore aggiornamento cliente: ${error.message}`);
        setSaving(false);
        return;
      }

      router.push(`/customers/${customer.id}`);
      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select()
      .single();

    if (error) {
      setMessage(`Errore salvataggio cliente: ${error.message}`);
      setSaving(false);
      return;
    }

    router.push(`/customers/${data.id}`);
  }

  return (
    <form onSubmit={saveCustomer} style={formStyle}>
      <div>
        <h2 style={sectionTitle}>
          {mode === "edit" ? "Modifica dati cliente" : "Dati cliente"}
        </h2>

        <div style={gridStyle}>
          <Field label="Nome e cognome">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Es. Mario Rossi"
              style={inputStyle}
            />
          </Field>

          <Field label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@cliente.it"
              style={inputStyle}
            />
          </Field>

          <Field label="Telefono">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Numero telefono"
              style={inputStyle}
            />
          </Field>

          <Field label="Codice badge">
            <input
              value={badgeCode}
              onChange={(e) => setBadgeCode(e.target.value)}
              placeholder="Codice badge"
              style={inputStyle}
            />
          </Field>

          <Field label="Stato abbonamento">
            <select
              value={subscriptionStatus}
              onChange={(e) => setSubscriptionStatus(e.target.value)}
              style={inputStyle}
            >
              <option value="active">Attivo</option>
              <option value="expired">Scaduto</option>
              <option value="pending">In attesa</option>
            </select>
          </Field>

          <Field label="Scadenza abbonamento">
            <input
              type="date"
              value={subscriptionExpiry}
              onChange={(e) => setSubscriptionExpiry(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Stato accesso">
            <select
              value={active ? "active" : "blocked"}
              onChange={(e) => setActive(e.target.value === "active")}
              style={inputStyle}
            >
              <option value="active">Attivo</option>
              <option value="blocked">Bloccato</option>
            </select>
          </Field>
        </div>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <div style={actionsStyle}>
        <button
          type="button"
          onClick={() =>
            customer ? router.push(`/customers/${customer.id}`) : router.push("/customers")
          }
          style={secondaryButton}
        >
          Annulla
        </button>

        <button type="submit" disabled={saving} style={primaryButton}>
          {saving
            ? "Salvataggio..."
            : mode === "edit"
            ? "Salva modifiche"
            : "Salva cliente"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: "8px" }}>
      <span
        style={{
          color: "var(--muted)",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  );
}

const formStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "26px",
  padding: "28px",
  display: "grid",
  gap: "24px",
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 22px 0",
  fontSize: "28px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
  gap: "18px",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "15px 16px",
  outline: "none",
  fontWeight: 600,
  width: "100%",
  boxSizing: "border-box",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  flexWrap: "wrap",
};

const primaryButton: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  borderRadius: "14px",
  padding: "14px 20px",
  fontWeight: "bold",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  background: "var(--bg-soft)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "14px 20px",
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