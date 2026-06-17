"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BGActionLink from "../../components/ui/BGActionLink";
import BGButton from "../../components/ui/BGButton";
import BGPageHeader from "../../components/ui/BGPageHeader";
import BGInput from "../../components/ui/BGInput";
import BGSelect from "../../components/ui/BGSelect";
import { normalizeAccessCode } from "../../lib/accessCodeNormalizer";
import CustomerDocumentRows from "../components/CustomerDocumentRows";
import type { ScannerDocumentType } from "../components/documentScannerUtils";

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
  const [pendingDocuments, setPendingDocuments] = useState<Partial<Record<ScannerDocumentType, any>>>({});

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
  const badgePreview = useMemo(() => normalizeAccessCode(form.badge_code), [form.badge_code]);
  const operationalBranch = {
    id: "ffbd8d1a-35a8-4b3e-8219-e9a56533d30c",
    name: "Body Energy",
    city: "Palermo",
    address: "Viale Amedeo D'Aosta 3",
  };

  function update(field: string, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePendingDocument(type: ScannerDocumentType, doc: any) {
    setPendingDocuments((current) => ({ ...current, [type]: doc }));
  }

  async function uploadPendingDocuments(customerId: string) {
    const entries = Object.entries(pendingDocuments) as [ScannerDocumentType, any][];
    const failures: string[] = [];
    for (const [type, doc] of entries) {
      if (!doc?.file) continue;
      const formData = new FormData();
      formData.append("file", doc.file);
      formData.append("document_type", type);
      if (type === "medical_certificate") {
        formData.append("valid_from", form.medical_certificate_start_date || doc.validFrom || "");
        formData.append("valid_until", form.medical_certificate_end_date || doc.validUntil || "");
      }
      const response = await fetch(`/api/customers/${customerId}/documents/upload`, { method: "POST", body: formData });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) failures.push(result?.error || `Upload ${type} non riuscito`);
    }
    return failures;
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
      !form.badge_code.trim()
    ) {
      setMessage(
        "Per usare la card devi inserire il codice badge / card RFID.",
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
        branch_id: operationalBranch.id,
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

      const documentFailures = await uploadPendingDocuments(customerId);
      if (documentFailures.length) {
        setMessage(`Cliente creato, documenti da completare: ${documentFailures.join("; ")}`);
        setSaving(false);
        return;
      }

      router.push(result.next_url || `/customers/${customerId}/contract`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore imprevisto.");
      setSaving(false);
    }
  }

  return (
    <div className="new-customer-page bg-page-shell">
      <style jsx>{`
        .new-customer-page {
          color: white;
          display: grid;
          gap: 22px;
        }

        form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 360px);
          gap: 22px;
          align-items: start;
        }

        .sections {
          display: grid;
          gap: 18px;
        }

        .card {
          display: grid;
          gap: 18px;
          border-radius: 28px;
          padding: 24px;
        }

        .card-title {
          font-size: 22px;
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1.1;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(220px, 1fr));
          gap: 16px;
          align-items: start;
        }

        .grid-3 {
          grid-template-columns: repeat(3, minmax(180px, 1fr));
        }

        .summary {
          position: sticky;
          top: 96px;
          border: 1px solid rgba(239, 68, 68, 0.24);
          border-radius: 28px;
          display: grid;
          gap: 16px;
          padding: 24px;
          background:
            radial-gradient(
              circle at top right,
              rgba(239, 68, 68, 0.2),
              transparent 44%
            ),
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.07),
              rgba(255, 255, 255, 0.02)
            ),
            rgba(8, 8, 10, 0.96);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
          backdrop-filter: blur(14px);
        }

        .summary-title {
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1.1;
        }

        .line {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          color: #d4d4d8;
          font-size: 14px;
          font-weight: 800;
        }

        .line span {
          min-width: 0;
          line-height: 1.35;
        }

        .line strong {
          justify-self: end;
          text-align: right;
          line-height: 1.25;
        }

        .total {
          margin-top: 2px;
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

        .branch-card {
          border: 1px solid rgba(239, 68, 68, 0.26);
          border-radius: 22px;
          padding: 18px;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(255, 255, 255, 0.04));
          display: grid;
          gap: 6px;
        }

        .branch-card span {
          color: #fca5a5;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .branch-card strong {
          color: #fff;
          font-size: 18px;
          font-weight: 950;
        }

        .branch-card small {
          color: #d4d4d8;
          font-weight: 800;
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

          .card,
          .summary {
            padding: 20px;
          }
        }
      `}</style>

      <BGPageHeader
        eyebrow="BodyGate Onboarding Platinum"
        title="Nuovo cliente"
        subtitle="Crea anagrafica, quota associativa, abbonamento, pagamento, credenziali e contratto in un unico flusso guidato."
        actions={
          <BGActionLink href="/customers" variant="ghost">
            ← Torna ai clienti
          </BGActionLink>
        }
      />

      <form className="bg-content-grid" onSubmit={submit}>
        <div className="sections bg-content-main">
          <section className="card bg-card bg-form-panel">
            <div className="card-title">1. Anagrafica</div>
            <div className="grid bg-form-grid">
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

          <section className="card bg-card bg-form-panel">
            <div className="card-title">2. Residenza</div>
            <div className="grid grid-3 bg-form-grid bg-form-grid-3">
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

          <section className="card bg-card bg-form-panel">
            <div className="card-title">3. Documento</div>
            <div className="grid bg-form-grid">
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

          <section className="card bg-card bg-form-panel">
            <div className="card-title">4. Emergenza e profilo</div>
            <div className="grid bg-form-grid">
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

          <section className="card bg-card bg-form-panel">
            <CustomerDocumentRows
              customer={{
                medical_certificate_start_date: form.medical_certificate_start_date,
                medical_certificate_end_date: form.medical_certificate_end_date,
              }}
              pendingDocuments={pendingDocuments}
              onPendingChange={updatePendingDocument}
            />
          </section>

          <section className="card bg-card bg-form-panel">
            <div className="card-title">5. Certificato e accesso</div>
            <div className="grid bg-form-grid">
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
              <div className="badge-rfid-field">
                <Field
                  label="Codice badge / card RFID"
                  value={form.badge_code}
                  onChange={(v) => update("badge_code", v)}
                />
                {form.badge_code.trim() ? (
                  <div className={badgePreview.controllerCode ? "bridge-preview" : "bridge-preview bridge-preview-warning"}>
                    <span>Codice bridge calcolato</span>
                    <b>{badgePreview.controllerCode || "Non derivabile"}</b>
                    {badgePreview.warning ? <small>{badgePreview.warning}</small> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="card bg-card bg-form-panel">
            <div className="card-title">6. Piano e pagamento</div>
            <div className="grid bg-form-grid">
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

            <label className="check-row bg-check-row bg-checkbox-row">
              <input
                type="checkbox"
                checked={form.privacy_consent}
                onChange={(e) => update("privacy_consent", e.target.checked)}
              />
              <span>Consenso privacy obbligatorio</span>
            </label>

            <label className="check-row bg-check-row bg-checkbox-row">
              <input
                type="checkbox"
                checked={form.marketing_consent}
                onChange={(e) => update("marketing_consent", e.target.checked)}
              />
              <span>Consenso marketing</span>
            </label>

            <label className="check-row bg-check-row bg-checkbox-row">
              <input
                type="checkbox"
                checked={form.photo_video_consent}
                onChange={(e) =>
                  update("photo_video_consent", e.target.checked)
                }
              />
              <span>Consenso foto e video</span>
            </label>
          </section>
        </div>

        <aside className="summary bg-content-sidebar bg-card-premium">
          <div className="summary-title">Riepilogo</div>

          <div className="branch-card" aria-label="Sede operativa predefinita">
            <span>Sede operativa</span>
            <strong>{operationalBranch.name} — {operationalBranch.city}</strong>
            <small>{operationalBranch.address}</small>
          </div>

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

          {message && (
            <div className="message bg-inline-message">{message}</div>
          )}
        </aside>
      </form>
    </div>
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
    <label className="bg-field bg-form-field">
      <span className="bg-field-label bg-form-label">{label}</span>
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
    <label className="bg-field bg-form-field">
      <span className="bg-field-label bg-form-label">{label}</span>
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
