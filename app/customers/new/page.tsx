"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BGActionLink from "../../components/ui/BGActionLink";
import BGButton from "../../components/ui/BGButton";
import BGInput from "../../components/ui/BGInput";
import BGSelect from "../../components/ui/BGSelect";

const plans = [
  { id: "", name: "Solo quota associativa", price: 0, duration: 0 },
  { id: "mensile", name: "Mensile", price: 45, duration: 30 },
  { id: "trimestrale", name: "Trimestrale", price: 120, duration: 90 },
  { id: "semestrale", name: "Semestrale", price: 200, duration: 180 },
  { id: "annuale", name: "Annuale", price: 350, duration: 365 },
];

const paymentMethods = [
  { id: "cash", label: "Contanti" },
  { id: "pos", label: "POS" },
  { id: "bank_transfer", label: "Bonifico" },
];

const accessTypes = [
  { id: "none", label: "Nessuna credenziale ora" },
  { id: "card", label: "Solo card / badge" },
  { id: "qr", label: "Solo QR Code" },
  { id: "qr_card", label: "QR Code + card" },
];

function accessTypeLabel(value: string) {
  return (
    accessTypes.find((item) => item.id === value)?.label || "QR Code + card"
  );
}

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new Error(
      result?.error || result?.message || `Errore chiamata ${url}`,
    );
  }

  return result;
}

export default function NewCustomerPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    gender: "",
    birth_date: "",
    birth_place: "",
    fiscal_code: "",
    phone: "",
    email: "",
    address: "",
    street_number: "",
    postal_code: "",
    city: "",
    province: "",
    country: "Italia",
    document_type: "",
    document_number: "",
    document_issued_by: "",
    document_issued_at: "",
    document_expires_at: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
    profession: "",
    fitness_goal: "",
    marketing_source: "",
    medical_certificate_start_date: "",
    medical_certificate_end_date: "",
    access_type: "qr_card",
    badge_code: "",
    controller_code: "",
    subscription_plan: "mensile",
    payment_method: "cash",
    privacy_consent: true,
    marketing_consent: false,
    photo_video_consent: false,
  });

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.id === form.subscription_plan) || plans[0];
  }, [form.subscription_plan]);

  const membershipAmount = 10;
  const totalAmount = membershipAmount + selectedPlan.price;

  function update(field: string, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setMessage("Nome e cognome sono obbligatori.");
      return;
    }

    if (!form.phone.trim()) {
      setMessage("Il telefono è obbligatorio.");
      return;
    }

    if (!form.fiscal_code.trim()) {
      setMessage("Il codice fiscale è obbligatorio.");
      return;
    }

    if (!form.privacy_consent) {
      setMessage("Il consenso privacy è obbligatorio.");
      return;
    }

    if (
      (form.access_type === "card" || form.access_type === "qr_card") &&
      !form.badge_code.trim() &&
      !form.controller_code.trim()
    ) {
      setMessage(
        "Per usare la card devi inserire badge code o controller code.",
      );
      return;
    }

    setSaving(true);

    try {
      const result = await postJson("/api/customers/create-platinum", {
        ...form,
        fiscal_code: form.fiscal_code.toUpperCase(),
        membership_amount: membershipAmount,
        subscription_plan_id: selectedPlan.id || null,
        subscription_name: selectedPlan.name,
        subscription_amount: selectedPlan.price,
        subscription_duration_days: selectedPlan.duration,
        payment_method: form.payment_method,
        customer_tags: [],
      });

      const customerId = result.customer_id;

      if (form.access_type === "qr" || form.access_type === "qr_card") {
        try {
          await postJson("/api/customers/create-mobile-pass", {
            customer_id: customerId,
          });
        } catch (error) {
          console.warn("Mobile pass non generato:", error);
        }

        try {
          await postJson("/api/dnake/create-user-qr", {
            customer_id: customerId,
          });
        } catch (error) {
          console.warn("QR DNake non generato:", error);
        }
      }

      router.push(result.next_url || `/customers/${customerId}/contract`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore imprevisto.");
      setSaving(false);
    }
  }

  return (
    <main className="new-customer-page">
      <style jsx>{`
        .new-customer-page {
          color: white;
          display: grid;
          gap: 22px;
        }

        .hero,
        .card,
        .summary {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.07),
              rgba(255, 255, 255, 0.02)
            ),
            rgba(8, 8, 10, 0.94);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
          backdrop-filter: blur(14px);
        }

        .hero {
          border-radius: 30px;
          padding: 26px;
          background:
            radial-gradient(
              circle at top left,
              rgba(239, 68, 68, 0.2),
              transparent 34%
            ),
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.075),
              rgba(255, 255, 255, 0.025)
            ),
            rgba(8, 8, 10, 0.94);
        }

        .back-row {
          display: flex;
          justify-content: flex-start;
        }

        .eyebrow {
          margin-top: 24px;
          color: #ef4444;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        h1 {
          margin: 10px 0 0;
          font-size: clamp(36px, 5vw, 62px);
          line-height: 0.9;
          letter-spacing: -0.06em;
          font-weight: 950;
        }

        .subtitle {
          margin-top: 14px;
          max-width: 760px;
          color: #a1a1aa;
          font-size: 15px;
          line-height: 1.6;
        }

        form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 20px;
          align-items: start;
        }

        .sections {
          display: grid;
          gap: 18px;
        }

        .card {
          border-radius: 28px;
          padding: 24px;
        }

        .card-title {
          font-size: 22px;
          font-weight: 950;
          letter-spacing: -0.04em;
          margin-bottom: 18px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .grid-3 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        label {
          display: grid;
          gap: 8px;
        }

        span {
          color: #8b8b8b;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .check-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 0;
          color: #d4d4d8;
          font-weight: 800;
        }

        .check-row input {
          width: 18px;
          height: 18px;
          accent-color: #ef4444;
        }

        .summary {
          position: sticky;
          top: 96px;
          border-radius: 28px;
          padding: 24px;
          border-color: rgba(239, 68, 68, 0.22);
          background:
            radial-gradient(
              circle at top right,
              rgba(239, 68, 68, 0.2),
              transparent 44%
            ),
            rgba(8, 8, 10, 0.96);
        }

        .summary-title {
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .line {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          color: #d4d4d8;
          font-size: 14px;
          font-weight: 800;
        }

        .line strong {
          text-align: right;
        }

        .total {
          margin-top: 18px;
          font-size: 42px;
          line-height: 0.95;
          font-weight: 950;
          letter-spacing: -0.06em;
        }

        .summary :global(.bg-button) {
          margin-top: 22px;
          width: 100%;
          min-height: 54px;
          font-size: 15px;
        }

        .message {
          margin-top: 14px;
          border-radius: 16px;
          padding: 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.28);
          color: #fecaca;
          font-weight: 800;
        }

        @media (max-width: 1100px) {
          form {
            grid-template-columns: 1fr;
          }

          .summary {
            position: relative;
            top: 0;
          }
        }

        @media (max-width: 720px) {
          .grid,
          .grid-3 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="hero">
        <div className="back-row">
          <BGActionLink href="/customers" variant="ghost">
            ← Torna ai clienti
          </BGActionLink>
        </div>

        <div className="eyebrow">BodyGate Onboarding Platinum</div>
        <h1>Nuovo cliente</h1>
        <div className="subtitle">
          Crea anagrafica, quota associativa, abbonamento, pagamento,
          credenziali e contratto in un unico flusso guidato.
        </div>
      </section>

      <form onSubmit={submit}>
        <div className="sections">
          <section className="card">
            <div className="card-title">1. Anagrafica</div>
            <div className="grid">
              <Field
                label="Nome *"
                value={form.first_name}
                onChange={(v) => update("first_name", v)}
              />
              <Field
                label="Cognome *"
                value={form.last_name}
                onChange={(v) => update("last_name", v)}
              />
              <Select
                label="Sesso"
                value={form.gender}
                onChange={(v) => update("gender", v)}
                options={["", "Maschio", "Femmina", "Altro"]}
              />
              <Field
                label="Data nascita"
                type="date"
                value={form.birth_date}
                onChange={(v) => update("birth_date", v)}
              />
              <Field
                label="Luogo nascita"
                value={form.birth_place}
                onChange={(v) => update("birth_place", v)}
              />
              <Field
                label="Codice fiscale *"
                value={form.fiscal_code}
                onChange={(v) => update("fiscal_code", v)}
              />
              <Field
                label="Telefono *"
                value={form.phone}
                onChange={(v) => update("phone", v)}
              />
              <Field
                label="Email"
                value={form.email}
                onChange={(v) => update("email", v)}
              />
            </div>
          </section>

          <section className="card">
            <div className="card-title">2. Residenza</div>
            <div className="grid grid-3">
              <Field
                label="Indirizzo"
                value={form.address}
                onChange={(v) => update("address", v)}
              />
              <Field
                label="Numero civico"
                value={form.street_number}
                onChange={(v) => update("street_number", v)}
              />
              <Field
                label="CAP"
                value={form.postal_code}
                onChange={(v) => update("postal_code", v)}
              />
              <Field
                label="Città"
                value={form.city}
                onChange={(v) => update("city", v)}
              />
              <Field
                label="Provincia"
                value={form.province}
                onChange={(v) => update("province", v)}
              />
              <Field
                label="Nazione"
                value={form.country}
                onChange={(v) => update("country", v)}
              />
            </div>
          </section>

          <section className="card">
            <div className="card-title">3. Documento</div>
            <div className="grid">
              <Select
                label="Tipo documento"
                value={form.document_type}
                onChange={(v) => update("document_type", v)}
                options={["", "Carta identità", "Patente", "Passaporto"]}
              />
              <Field
                label="Numero documento"
                value={form.document_number}
                onChange={(v) => update("document_number", v)}
              />
              <Field
                label="Rilasciato da"
                value={form.document_issued_by}
                onChange={(v) => update("document_issued_by", v)}
              />
              <Field
                label="Data rilascio"
                type="date"
                value={form.document_issued_at}
                onChange={(v) => update("document_issued_at", v)}
              />
              <Field
                label="Data scadenza"
                type="date"
                value={form.document_expires_at}
                onChange={(v) => update("document_expires_at", v)}
              />
            </div>
          </section>

          <section className="card">
            <div className="card-title">4. Emergenza e profilo</div>
            <div className="grid">
              <Field
                label="Contatto emergenza"
                value={form.emergency_contact_name}
                onChange={(v) => update("emergency_contact_name", v)}
              />
              <Field
                label="Telefono emergenza"
                value={form.emergency_contact_phone}
                onChange={(v) => update("emergency_contact_phone", v)}
              />
              <Field
                label="Parentela"
                value={form.emergency_contact_relation}
                onChange={(v) => update("emergency_contact_relation", v)}
              />
              <Field
                label="Professione"
                value={form.profession}
                onChange={(v) => update("profession", v)}
              />
              <Select
                label="Obiettivo fitness"
                value={form.fitness_goal}
                onChange={(v) => update("fitness_goal", v)}
                options={[
                  "",
                  "Dimagrimento",
                  "Massa muscolare",
                  "Fitness",
                  "Bodybuilding",
                  "Powerlifting",
                  "Riabilitazione",
                  "Altro",
                ]}
              />
              <Select
                label="Come ci ha conosciuto"
                value={form.marketing_source}
                onChange={(v) => update("marketing_source", v)}
                options={[
                  "",
                  "Instagram",
                  "Facebook",
                  "TikTok",
                  "Google",
                  "Passaparola",
                  "Volantino",
                  "Altro",
                ]}
              />
            </div>
          </section>

          <section className="card">
            <div className="card-title">5. Certificato e accesso</div>
            <div className="grid">
              <Field
                label="Inizio certificato"
                type="date"
                value={form.medical_certificate_start_date}
                onChange={(v) => update("medical_certificate_start_date", v)}
              />
              <Field
                label="Fine certificato"
                type="date"
                value={form.medical_certificate_end_date}
                onChange={(v) => update("medical_certificate_end_date", v)}
              />
              <Select
                label="Tipo accesso"
                value={form.access_type}
                onChange={(v) => update("access_type", v)}
                options={accessTypes.map((a) => a.id)}
                labels={Object.fromEntries(
                  accessTypes.map((a) => [a.id, a.label]),
                )}
              />
              <Field
                label="Codice badge / card"
                value={form.badge_code}
                onChange={(v) => update("badge_code", v)}
              />
              <Field
                label="Controller code"
                value={form.controller_code}
                onChange={(v) => update("controller_code", v)}
              />
            </div>
          </section>

          <section className="card">
            <div className="card-title">6. Piano e pagamento</div>
            <div className="grid">
              <Select
                label="Abbonamento"
                value={form.subscription_plan}
                onChange={(v) => update("subscription_plan", v)}
                options={plans.map((p) => p.id)}
                labels={Object.fromEntries(
                  plans.map((p) => [
                    p.id,
                    `${p.name}${p.price ? ` - EUR ${p.price}` : ""}`,
                  ]),
                )}
              />
              <Select
                label="Metodo pagamento"
                value={form.payment_method}
                onChange={(v) => update("payment_method", v)}
                options={paymentMethods.map((m) => m.id)}
                labels={Object.fromEntries(
                  paymentMethods.map((m) => [m.id, m.label]),
                )}
              />
            </div>

            <div className="check-row">
              <input
                type="checkbox"
                checked={form.privacy_consent}
                onChange={(e) => update("privacy_consent", e.target.checked)}
              />
              Consenso privacy obbligatorio
            </div>

            <div className="check-row">
              <input
                type="checkbox"
                checked={form.marketing_consent}
                onChange={(e) => update("marketing_consent", e.target.checked)}
              />
              Consenso marketing
            </div>

            <div className="check-row">
              <input
                type="checkbox"
                checked={form.photo_video_consent}
                onChange={(e) =>
                  update("photo_video_consent", e.target.checked)
                }
              />
              Consenso foto e video
            </div>
          </section>
        </div>

        <aside className="summary">
          <div className="summary-title">Riepilogo</div>

          <div className="line">
            <span>Quota associativa</span>
            <strong>EUR {membershipAmount}</strong>
          </div>

          <div className="line">
            <span>Abbonamento</span>
            <strong>{selectedPlan.name}</strong>
          </div>

          <div className="line">
            <span>Importo abbonamento</span>
            <strong>EUR {selectedPlan.price}</strong>
          </div>

          <div className="line">
            <span>Accesso</span>
            <strong>{accessTypeLabel(form.access_type)}</strong>
          </div>

          <div className="line">
            <span>Pagamento</span>
            <strong>
              {paymentMethods.find((m) => m.id === form.payment_method)?.label}
            </strong>
          </div>

          <div className="total">EUR {totalAmount}</div>

          <BGButton type="submit" disabled={saving}>
            {saving
              ? "Creazione in corso..."
              : "Crea cliente, QR e vai al contratto"}
          </BGButton>

          {message && <div className="message">{message}</div>}
        </aside>
      </form>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <BGInput
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  labels = {},
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <label>
      <span>{label}</span>
      <BGSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option || "empty"} value={option}>
            {labels[option] || option || "Seleziona"}
          </option>
        ))}
      </BGSelect>
    </label>
  );
}
