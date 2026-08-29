"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BGAlert, BGButton, BGInput, BGSelect } from "@/components/bodygate-ui";

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

    const response = await fetch("/api/customers/legacy-form-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "edit" && customer
          ? { mode: "edit", customer_id: customer.id, payload }
          : { mode: "create", payload },
      ),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setMessage(
        `Errore salvataggio cliente: ${result?.error || "Errore sconosciuto"}`,
      );
      setSaving(false);
      return;
    }

    router.push(`/customers/${result.id}`);
  }

  return (
    <form onSubmit={saveCustomer} style={formStyle}>
      <div>
        <h2 style={sectionTitle}>
          {mode === "edit" ? "Modifica dati cliente" : "Dati cliente"}
        </h2>

        <div style={gridStyle}>
          <Field label="Nome e cognome">
            <BGInput
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Es. Mario Rossi"
              required
            />
          </Field>

          <Field label="Email">
            <BGInput
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@cliente.it"
            />
          </Field>

          <Field label="Telefono">
            <BGInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Numero telefono"
            />
          </Field>

          <Field label="Codice badge">
            <BGInput
              value={badgeCode}
              onChange={(e) => setBadgeCode(e.target.value)}
              placeholder="Codice badge"
            />
          </Field>

          <Field label="Stato abbonamento">
            <BGSelect
              value={subscriptionStatus}
              onChange={(e) => setSubscriptionStatus(e.target.value)}
            >
              <option value="active">Attivo</option>
              <option value="expired">Scaduto</option>
              <option value="pending">In attesa</option>
            </BGSelect>
          </Field>

          <Field label="Scadenza abbonamento">
            <BGInput
              type="date"
              value={subscriptionExpiry}
              onChange={(e) => setSubscriptionExpiry(e.target.value)}
            />
          </Field>

          <Field label="Stato accesso">
            <BGSelect
              value={active ? "active" : "blocked"}
              onChange={(e) => setActive(e.target.value === "active")}
            >
              <option value="active">Attivo</option>
              <option value="blocked">Bloccato</option>
            </BGSelect>
          </Field>
        </div>
      </div>

      {message && <BGAlert title="Verifica i dati" tone="danger">{message}</BGAlert>}

      <div style={actionsStyle}>
        <BGButton
          type="button"
          onClick={() =>
            customer ? router.push(`/customers/${customer.id}`) : router.push("/customers")
          }
          variant="secondary"
        >
          Annulla
        </BGButton>

        <BGButton type="submit" disabled={saving}>
          {saving
            ? "Salvataggio..."
            : mode === "edit"
            ? "Salva modifiche"
            : "Salva cliente"}
        </BGButton>
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

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  flexWrap: "wrap",
};
