import Link from "next/link";

export type BGCustomer = {
  id: string;
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  badge_code?: string | null;
  subscription_status?: string | null;
  subscription_expiry?: string | null;
  is_active?: boolean | null;
  access_status?: string | null;
  access_state?: string | null;
  medical_certificate_status?: string | null;
  medical_certificate_end_date?: string | null;
  medical_state?: string | null;
};

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "BG"
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("it-IT");
}

function normalizeState(customer: BGCustomer) {
  if (customer.is_active === false) return "blocked";
  return customer.access_state || customer.access_status || "active";
}

function statusLabel(state: string) {
  if (state === "expiring") return "In scadenza";
  if (state === "expired") return "Scaduto";
  if (state === "blocked" || state === "suspended") return "Sospeso";
  return "Attivo";
}

function statusClass(state: string) {
  if (state === "expiring") return "bg2-pill-expiring";
  if (state === "expired" || state === "blocked" || state === "suspended") {
    return "bg2-pill-danger";
  }
  return "bg2-pill-active";
}

function certificateLabel(customer: BGCustomer) {
  const value =
    customer.medical_state ||
    customer.medical_certificate_status ||
    "missing";

  if (value === "valid") return "Valido";
  if (value === "expired") return "Scaduto";
  if (value === "expiring") return "In scadenza";
  return "Da verificare";
}

export default function BGCustomerCard({ customer }: { customer: BGCustomer }) {
  const name =
    customer.display_name ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    "Cliente BodyGate";

  const state = normalizeState(customer);
  const danger = ["expired", "blocked", "suspended"].includes(state);
  const expiring = state === "expiring";

  return (
    <article
      className={`bg2-customer ${
        danger ? "bg2-customer-danger" : expiring ? "bg2-customer-expiring" : ""
      }`}
    >
      <div className="bg2-customer-main">
        <div className="bg2-avatar">{initials(name)}</div>

        <div className="bg2-customer-title">
          <div className="bg2-name">{name}</div>
          <div className="bg2-contact">
            {customer.phone || customer.email || "Contatto da completare"}
          </div>
        </div>
      </div>

      <div className={`bg2-pill ${statusClass(state)}`}>
        <span />
        {statusLabel(state)}
      </div>

      <div className="bg2-details">
        <div className="bg2-row">
          <span>Badge</span>
          <strong>{customer.badge_code || "—"}</strong>
        </div>

        <div className="bg2-row">
          <span>Abbonamento</span>
          <strong>{customer.subscription_status || "Da verificare"}</strong>
        </div>

        <div className="bg2-row">
          <span>Certificato</span>
          <strong>{certificateLabel(customer)}</strong>
        </div>

        <div className="bg2-row">
          <span>Scadenza</span>
          <strong>{formatDate(customer.subscription_expiry)}</strong>
        </div>
      </div>

      <div className="bg2-card-actions">
        <Link className="bg2-primary-action" href={`/customers/${customer.id}`}>
          Apri scheda
        </Link>

        <Link className="bg2-secondary-action" href={`/payments?customer=${customer.id}`}>
          Incasso
        </Link>
      </div>
    </article>
  );
}