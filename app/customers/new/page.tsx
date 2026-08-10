"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BGButton from "@/components/bodygate-ui/BGButton";
import BGPageHeader from "@/components/bodygate-ui/BGPageHeader";
import BGInput from "@/components/bodygate-ui/BGInput";
import BGSelect from "@/components/bodygate-ui/BGSelect";
import { normalizeAccessCode } from "../../lib/accessCodeNormalizer";
import { safeRandomId } from "../../lib/safeRandomId";
import CustomerDocumentRows from "../components/CustomerDocumentRows";
import type { DocumentStatus } from "../components/CustomerDocumentRows";
import type { ScannerDocumentType } from "../components/documentScannerUtils";

const fallbackPlans: PlatinumPlan[] = [];

type PlatinumPlan = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

type OperationalBranch = {
  id: string;
  name: string;
  city: string;
  address: string;
};

type PendingDocument = {
  file: File;
  status?: DocumentStatus;
  validFrom?: string;
  validUntil?: string;
  viewUrl?: string;
};

type PlatinumConfigResponse = {
  ok?: boolean;
  error?: string;
  branch?: Partial<OperationalBranch>;
  membership_fee?: {
    price?: number;
  };
  badge_fee?: {
    name?: string;
    price?: number;
    is_active?: boolean;
  };
  plans?: Array<{
    id?: string;
    name?: string;
    price?: number;
    duration_days?: number;
    duration?: number;
  }>;
};

const paymentMethods = [
  { id: "cash", label: "Contanti" },
  { id: "pos", label: "POS" },
  { id: "bank_transfer", label: "Bonifico" },
];

const accessTypes = [
  { id: "none", label: "Nessuna credenziale ora" },
  { id: "card", label: "Solo card / badge (assegnabile dopo)" },
  { id: "qr", label: "Solo QR Code" },
  { id: "qr_card", label: "QR Code + card (badge assegnabile dopo)" },
];

function accessTypeLabel(value: string) {
  return (
    accessTypes.find((item) => item.id === value)?.label || "QR Code + card"
  );
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
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
  const [onboardingOperationId, setOnboardingOperationId] = useState("");
  const [configLoading, setConfigLoading] = useState(true);
  const [plans, setPlans] = useState<PlatinumPlan[]>(fallbackPlans);
  const [membershipAmount, setMembershipAmount] = useState(10);
  const [badgeFee, setBadgeFee] = useState({ name: "Badge RFID", price: 5, isActive: true });
  const [operationalBranch, setOperationalBranch] = useState<OperationalBranch>({
    id: "ffbd8d1a-35a8-4b3e-8219-e9a56533d30c",
    name: "Body Energy",
    city: "Palermo",
    address: "Viale Amedeo D'Aosta 3",
  });
  const [pendingDocuments, setPendingDocuments] = useState<Partial<Record<ScannerDocumentType, PendingDocument>>>({});

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
    subscription_choice: "with_subscription",
    subscription_plan: "",
    payment_method: "cash",
    privacy_consent: true,
    marketing_consent: false,
    photo_video_consent: false,
    badge_charge_mode: "not_included",
    badge_complimentary_reason: "",
  });

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.id === form.subscription_plan) || plans[0] || { id: "", name: "", price: 0, duration: 0 };
  }, [form.subscription_plan, plans]);

  const withSubscription = form.subscription_choice === "with_subscription";
  const badgeAmount = form.badge_charge_mode === "charged" && badgeFee.isActive ? badgeFee.price : 0;
  const totalAmount = membershipAmount + (withSubscription ? selectedPlan.price : 0) + badgeAmount;
  const badgePreview = useMemo(() => normalizeAccessCode(form.badge_code), [form.badge_code]);

  useEffect(() => {
    let active = true;

    async function loadPlatinumConfig() {
      setConfigLoading(true);

      try {
        const response = await fetch("/api/customers/create-platinum", {
          cache: "no-store",
        });
        const result = (await response.json().catch(() => null)) as PlatinumConfigResponse | null;

        if (!active) return;

        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || "Configurazione Platinum non disponibile.");
        }

        const activePlans = Array.isArray(result.plans)
          ? result.plans.map((plan) => ({
              id: String(plan.id || ""),
              name: String(plan.name || "Abbonamento"),
              price: Number(plan.price || 0),
              duration: Number(plan.duration_days || plan.duration || 0),
            }))
          : [];

        setPlans(activePlans);
        setMembershipAmount(Number(result.membership_fee?.price || 10));
        setBadgeFee({
          name: result.badge_fee?.name || "Badge RFID",
          price: Number(result.badge_fee?.price || 5),
          isActive: result.badge_fee?.is_active !== false,
        });

        if (result.branch?.id) {
          setOperationalBranch({
            id: result.branch.id,
            name: result.branch.name || "Sede operativa",
            city: result.branch.city || "",
            address: result.branch.address || "",
          });
        }

        setForm((current) => ({
          ...current,
          subscription_plan: activePlans[0]?.id || "",
        }));
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Configurazione Platinum non disponibile.");
        }
      } finally {
        if (active) setConfigLoading(false);
      }
    }

    loadPlatinumConfig();

    return () => {
      active = false;
    };
  }, []);

  function update(field: string, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    setForm((current) => {
      const canDeliverBadge = (current.access_type === "card" || current.access_type === "qr_card") && Boolean(current.badge_code.trim());
      if (!canDeliverBadge && current.badge_charge_mode !== "not_included") return { ...current, badge_charge_mode: "not_included" };
      if (canDeliverBadge && current.badge_charge_mode === "not_included") return { ...current, badge_charge_mode: "charged" };
      return current;
    });
  }, [form.access_type, form.badge_code]);

  function updatePendingDocument(type: ScannerDocumentType, doc: PendingDocument) {
    setPendingDocuments((current) => ({ ...current, [type]: doc }));
  }

  async function uploadPendingDocuments(customerId: string) {
    const entries = Object.entries(pendingDocuments) as [ScannerDocumentType, PendingDocument][];
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

    if (withSubscription && !selectedPlan.id) {
      setMessage("Seleziona un piano ufficiale per creare un abbonamento oppure scegli Solo quota associativa.");
      return;
    }

    if (!form.privacy_consent) {
      setMessage("Il consenso privacy è obbligatorio.");
      return;
    }

    if (form.badge_charge_mode === "complimentary" && !form.badge_complimentary_reason.trim()) {
      setMessage("Per omaggiare il badge RFID devi indicare il motivo operatore.");
      return;
    }

    const operationId =
      onboardingOperationId || safeRandomId("onboarding");

    if (!onboardingOperationId) {
      setOnboardingOperationId(operationId);
    }

    setSaving(true);

    try {
      const result = await postJson("/api/customers/create-platinum", {
        ...form,
        fiscal_code: form.fiscal_code.toUpperCase(),
        membership_amount: membershipAmount,
        subscription_choice: withSubscription ? "with_subscription" : "membership_only",
        subscription_plan_id: withSubscription ? selectedPlan.id : null,
        payment_method: form.payment_method,
        customer_tags: [],
        branch_id: operationalBranch.id,
        badge_charge_mode: form.badge_charge_mode,
        badge_complimentary_reason: form.badge_complimentary_reason,
        operation_id: operationId,
      }, {
        "Idempotency-Key": operationId,
      });

      const customerId = result.customer_id;

      const provisioning: string[] = [];
      const provisioningWarnings: string[] = [];
      if (form.access_type === "qr" || form.access_type === "qr_card") {
        try {
          await postJson("/api/customers/create-mobile-pass", { customer_id: customerId });
          provisioning.push("Mobile Pass creato");
        } catch (error) {
          provisioningWarnings.push(`Mobile Pass non generato: ${error instanceof Error ? error.message : "errore imprevisto"}`);
        }

        try {
          await postJson("/api/dnake/create-user-qr", { customer_id: customerId });
          provisioning.push("QR DNake creato");
        } catch (error) {
          provisioningWarnings.push(`QR DNake non generato: ${error instanceof Error ? error.message : "errore imprevisto"}`);
        }
      }

      const documentFailures = await uploadPendingDocuments(customerId);
      if (documentFailures.length) {
        setMessage(`Cliente creato. ${provisioning.join(" · ")} ${provisioningWarnings.join(" · ")} Documenti da completare: ${documentFailures.join("; ")}. Apri la scheda cliente o vai al contratto quando lo stato è chiaro.`);
        setSaving(false);
        return;
      }

      if (provisioningWarnings.length) {
        setMessage(`Cliente creato con riepilogo: quota creata · ${withSubscription ? "abbonamento creato · " : "solo quota associativa · "}pagamento creato · ricevuta creata · ${form.badge_code ? "badge creato · " : ""}${provisioning.join(" · ")} · contratto da firmare. Warning: ${provisioningWarnings.join(" · ")}. Azioni: riprova dalla scheda cliente oppure vai al contratto.`);
        setSaving(false);
        return;
      }

      setOnboardingOperationId("");
      router.push(result.next_url || `/customers/${customerId}/contract`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore imprevisto.");
      setSaving(false);
    }
  }

  return (
    <main className="new-customer-page bg-page-shell">
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

        .badge-charge-card {
          grid-column: 1 / -1;
          border: 1px solid rgba(239, 68, 68, 0.28);
          border-radius: 22px;
          padding: 16px;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.14), rgba(255,255,255,0.04));
          display: grid;
          gap: 12px;
        }
        .badge-charge-card button {
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 999px;
          padding: 10px 14px;
          background: rgba(255,255,255,0.08);
          color: white;
          font-weight: 950;
          cursor: pointer;
        }
        .badge-charge-card button.active { background: #ef4444; border-color: #fca5a5; }
        .hint { color: #a1a1aa; font-size: 13px; font-weight: 800; }

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
          <BGButton href="/customers" variant="ghost">
            ← Torna ai clienti
          </BGButton>
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
                  label="Codice badge / card RFID (opzionale)"
                  value={form.badge_code}
                  onChange={(v) => update("badge_code", v)}
                />
                <div className="hint">
                  Puoi completare l'iscrizione senza badge e assegnarlo successivamente dalla scheda cliente.
                </div>
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
                label="Tipo onboarding"
                value={form.subscription_choice}
                onChange={(v) => update("subscription_choice", v)}
                options={["with_subscription", "membership_only"]}
                labels={{ with_subscription: "Quota + abbonamento", membership_only: "Solo quota associativa" }}
              />
              <Select
                label="Piano abbonamento"
                value={form.subscription_plan}
                onChange={(v) => update("subscription_plan", v)}
                options={plans.map((p) => p.id)}
                labels={Object.fromEntries(
                  plans.map((p) => [
                    p.id,
                    `${p.name}${p.price ? ` - ${new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(p.price)}` : ""}`,
                  ]),
                )}
              />
              {form.subscription_choice === "membership_only" ? (
                <p className="hint">Solo quota associativa: non verrà creato alcun abbonamento e il cliente non potrà accedere finché non avrà un abbonamento valido.</p>
              ) : null}

              <div className="badge-charge-card">
                <div className="card-title">Badge in ricevuta</div>
                <div className="hint">Aggiungi badge alla ricevuta — {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(badgeFee.price)}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[
                    ["charged", `Addebitato ${new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(badgeFee.price)}`],
                    ["complimentary", "Omaggiato €0,00"],
                    ["not_included", "Non consegnato"],
                  ].map(([mode, label]) => (
                    <button key={mode} type="button" className={form.badge_charge_mode === mode ? "active" : ""} onClick={() => update("badge_charge_mode", mode)}>
                      {label}
                    </button>
                  ))}
                </div>
                {form.badge_charge_mode === "complimentary" ? (
                  <Field label="Motivo omaggio badge *" value={form.badge_complimentary_reason} onChange={(v) => update("badge_complimentary_reason", v)} />
                ) : null}
              </div>
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
            <strong>{new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(membershipAmount)}</strong>
          </div>

          <div className="line">
            <span>Abbonamento</span>
            <strong>{withSubscription ? selectedPlan.name : "Solo quota associativa"}</strong>
          </div>

          <div className="line">
            <span>{withSubscription ? `Abbonamento ${selectedPlan.name}` : "Abbonamento"}</span>
            <strong>{withSubscription ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(selectedPlan.price) : "—"}</strong>
          </div>

          <div className="line">
            <span>{badgeFee.name}</span>
            <strong>{form.badge_charge_mode === "charged" ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(badgeAmount) : form.badge_charge_mode === "complimentary" ? "Omaggiato €0,00" : "Non consegnato"}</strong>
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

          <div className="total">{new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(totalAmount)}</div>

          <BGButton type="submit" disabled={saving || configLoading}>
            {saving
              ? "Creazione in corso..."
              : configLoading
                ? "Caricamento configurazione..."
                : (form.access_type === "qr" || form.access_type === "qr_card")
                  ? "Crea cliente, configura accesso e vai al contratto"
                  : "Crea cliente e vai al contratto"}
          </BGButton>

          {message && (
            <div className="message bg-inline-message">{message}</div>
          )}
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
