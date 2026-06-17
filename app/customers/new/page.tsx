"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BGActionLink from "../../components/ui/BGActionLink";
import BGButton from "../../components/ui/BGButton";
import BGInput from "../../components/ui/BGInput";
import BGSelect from "../../components/ui/BGSelect";
import BGStatusBadge from "../../components/ui/BGStatusBadge";
import { BGProgress, BGProgressSteps, BGStickyActions } from "../../components/ui/BGPrimitives";
import { normalizeAccessCode } from "../../lib/accessCodeNormalizer";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
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

const onboardingSteps = [
  "Dati essenziali",
  "Identità e documenti",
  "Piano e pagamento",
  "Accesso e consensi",
  "Verifica finale",
];

type OnboardingStatus = "completed" | "recoverable" | "pending" | "not_required";

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
  const [partialResults, setPartialResults] = useState<Array<{ label: string; status: OnboardingStatus }>>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState(false);
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

  const hasUnsavedChanges = useMemo(() => Object.entries(form).some(([key, value]) => {
    if (key === "country") return value !== "Italia";
    if (key === "access_type") return value !== "qr_card";
    if (key === "subscription_plan") return value !== "mensile";
    if (key === "payment_method") return value !== "cash";
    if (key === "privacy_consent") return value !== true;
    if (typeof value === "boolean") return value;
    return String(value || "").trim().length > 0;
  }) || Object.keys(pendingDocuments).length > 0, [form, pendingDocuments]);
  useUnsavedChanges(hasUnsavedChanges && !saving && !submittedSuccessfully);

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

  function validateStep(step = activeStep) {
    const errors: string[] = [];
    if (step === 0) {
      if (!form.first_name.trim()) errors.push("Inserisci il nome.");
      if (!form.last_name.trim()) errors.push("Inserisci il cognome.");
      if (!form.phone.trim()) errors.push("Inserisci il telefono.");
      if (!form.fiscal_code.trim()) errors.push("Inserisci il codice fiscale.");
    }
    if (step === 3) {
      if ((form.access_type === "card" || form.access_type === "qr_card") && !form.badge_code.trim()) {
        errors.push("Inserisci il codice badge / card RFID o scegli un accesso senza card.");
      }
      if (!form.privacy_consent) errors.push("Il consenso privacy è obbligatorio.");
    }
    setStepErrors(errors);
    if (errors.length) {
      window.setTimeout(() => document.querySelector<HTMLElement>(".onboarding-error-summary")?.focus(), 0);
      return false;
    }
    return true;
  }

  function stepState(index: number): "completed" | "error" | "current" | "pending" {
    if (index === activeStep && stepErrors.length) return "error";
    if (index === activeStep) return "current";
    if (index < activeStep) return "completed";
    return "pending";
  }

  function goToStep(index: number) {
    setActiveStep(index);
    setStepErrors([]);
  }

  function primaryAction() {
    if (activeStep < onboardingSteps.length - 1) {
      if (validateStep(activeStep)) goToStep(activeStep + 1);
      return;
    }
    const valid = [0, 3].every((step) => validateStep(step));
    if (!valid) return;
    const formElement = document.querySelector<HTMLFormElement>(".platinum-onboarding-form");
    formElement?.requestSubmit();
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
    if (saving) return;
    setMessage("");
    setPartialResults([]);

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
    const outcomes: Array<{ label: string; status: OnboardingStatus }> = [];

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
      outcomes.push({ label: "Cliente", status: "completed" });
      outcomes.push({ label: "Quota associativa", status: membershipAmount > 0 ? "completed" : "not_required" });
      outcomes.push({ label: "Abbonamento", status: selectedPlan.id ? "completed" : "not_required" });
      outcomes.push({ label: "Pagamento", status: totalAmount > 0 ? "completed" : "not_required" });
      outcomes.push({ label: "Ricevuta", status: totalAmount > 0 ? "completed" : "not_required" });

      if (form.access_type === "qr" || form.access_type === "qr_card") {
        try {
          await postJson("/api/customers/create-mobile-pass", { customer_id: customerId });
          outcomes.push({ label: "Mobile Pass", status: "completed" });
        } catch (error) {
          console.warn("[BodyGate onboarding] Mobile pass non generato", error);
          outcomes.push({ label: "Mobile Pass", status: "recoverable" });
        }

        try {
          await postJson("/api/dnake/create-user-qr", { customer_id: customerId });
          outcomes.push({ label: "QR DNake", status: "completed" });
        } catch (error) {
          console.warn("[BodyGate onboarding] QR DNake non generato", error);
          outcomes.push({ label: "QR DNake", status: "recoverable" });
        }
      }

      const documentFailures = await uploadPendingDocuments(customerId);
      outcomes.push({ label: "Documenti", status: documentFailures.length ? "recoverable" : Object.keys(pendingDocuments).length ? "completed" : "pending" });
      outcomes.push({ label: "Certificato", status: form.medical_certificate_end_date ? "completed" : "pending" });
      outcomes.push({ label: "Contratto", status: "pending" });
      setPartialResults(outcomes);
      setSubmittedSuccessfully(true);
      if (documentFailures.length) {
        setMessage(`Cliente creato. Alcuni documenti sono recuperabili: ${documentFailures.join("; ")}`);
        setSaving(false);
        return;
      }

      router.push(result.next_url || `/customers/${customerId}/contract`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore imprevisto.");
      setSaving(false);
    }
  }

  const progressValue = Math.round(((activeStep + 1) / onboardingSteps.length) * 100);
  const finalSummary: Array<{ label: string; value: string; status: OnboardingStatus }> = [
    { label: "Cliente", value: `${form.first_name || "—"} ${form.last_name || ""}`.trim(), status: form.first_name && form.last_name ? "completed" : "pending" },
    { label: "Sede", value: `${operationalBranch.name} · ${operationalBranch.city}`, status: "completed" },
    { label: "Quota associativa", value: `EUR ${membershipAmount}`, status: membershipAmount > 0 ? "completed" : "not_required" },
    { label: "Abbonamento", value: selectedPlan.name, status: selectedPlan.id ? "completed" : "not_required" },
    { label: "Pagamento", value: paymentMethods.find((m) => m.id === form.payment_method)?.label || "—", status: totalAmount > 0 ? "pending" : "not_required" },
    { label: "Ricevuta", value: totalAmount > 0 ? "Generata dal flusso ufficiale" : "Non richiesta", status: totalAmount > 0 ? "pending" : "not_required" },
    { label: "Badge", value: form.badge_code ? "Card indicata" : "Da associare", status: form.badge_code ? "completed" : form.access_type === "qr" || form.access_type === "none" ? "not_required" : "pending" },
    { label: "QR DNake", value: form.access_type.includes("qr") ? "Richiesto" : "Non richiesto", status: form.access_type.includes("qr") ? "pending" : "not_required" },
    { label: "Mobile Pass", value: form.access_type.includes("qr") ? "Richiesto" : "Non richiesto", status: form.access_type.includes("qr") ? "pending" : "not_required" },
    { label: "Documenti", value: Object.keys(pendingDocuments).length ? `${Object.keys(pendingDocuments).length} pronti` : "Da completare", status: Object.keys(pendingDocuments).length ? "completed" : "pending" },
    { label: "Certificato", value: form.medical_certificate_end_date || "Da completare", status: form.medical_certificate_end_date ? "completed" : "pending" },
    { label: "Contratto", value: "Apre dopo la creazione", status: "pending" },
  ];
  const summaryItems = partialResults.length
    ? finalSummary.map((item) => partialResults.find((result) => result.label === item.label) ? { ...item, status: partialResults.find((result) => result.label === item.label)!.status } : item)
    : finalSummary;

  return (
    <main className="platinum-onboarding-page">
      <header className="platinum-onboarding-header">
        <div>
          <div className="platinum-eyebrow">Nuovo cliente</div>
          <h1>Onboarding reception</h1>
          <p>Step {activeStep + 1} di {onboardingSteps.length}: {onboardingSteps[activeStep]}</p>
        </div>
        <BGActionLink href="/customers" variant="ghost">Torna ai clienti</BGActionLink>
      </header>

      <section className="platinum-progress-panel" aria-label="Progresso onboarding">
        <BGProgress value={progressValue} />
        <BGProgressSteps steps={onboardingSteps} active={activeStep} />
      </section>

      {stepErrors.length > 0 && (
        <section className="onboarding-error-summary" tabIndex={-1} role="alert" aria-label="Errori da correggere">
          <strong>Completa i dati richiesti</strong>
          <ul>{stepErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </section>
      )}

      {message && <section className="onboarding-error-summary" role="status"><strong>Esito operazione</strong><p>{message}</p></section>}

      <form className="platinum-onboarding-form" onSubmit={submit}>
        <div className="platinum-onboarding-main">
          <nav className="platinum-step-list" aria-label="Step onboarding">
            {onboardingSteps.map((step, index) => (
              <button key={step} type="button" className={`platinum-step-chip platinum-step-${stepState(index)}`} onClick={() => goToStep(index)} aria-current={index === activeStep ? "step" : undefined}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
                <em>{stepState(index) === "completed" ? "Completato" : stepState(index) === "error" ? "Errore" : index === activeStep ? "In corso" : "Da completare"}</em>
              </button>
            ))}
          </nav>

          <section className="platinum-step-card">
            <div className="platinum-step-card-header">
              <div>
                <span>Step {activeStep + 1}</span>
                <h2>{onboardingSteps[activeStep]}</h2>
              </div>
              <BGStatusBadge tone={stepErrors.length ? "danger" : activeStep === onboardingSteps.length - 1 ? "info" : "neutral"}>{stepErrors.length ? "Errore" : "Operativo"}</BGStatusBadge>
            </div>

            {activeStep === 0 && <div className="platinum-field-grid">
              <Field label="Nome *" value={form.first_name} onChange={(v) => update("first_name", v)} />
              <Field label="Cognome *" value={form.last_name} onChange={(v) => update("last_name", v)} />
              <Field label="Telefono *" value={form.phone} onChange={(v) => update("phone", v)} />
              <Field label="Codice fiscale *" value={form.fiscal_code} onChange={(v) => update("fiscal_code", v)} />
              <Field label="Email" value={form.email} onChange={(v) => update("email", v)} />
              <Field label="Data nascita" type="date" value={form.birth_date} onChange={(v) => update("birth_date", v)} />
              <Field label="Luogo nascita" value={form.birth_place} onChange={(v) => update("birth_place", v)} />
              <Select label="Sesso" value={form.gender} onChange={(v) => update("gender", v)} options={["", "Maschio", "Femmina", "Altro"]} />
            </div>}

            {activeStep === 1 && <div className="platinum-step-stack">
              <div className="platinum-field-grid platinum-field-grid-3">
                <Field label="Indirizzo" value={form.address} onChange={(v) => update("address", v)} />
                <Field label="Numero civico" value={form.street_number} onChange={(v) => update("street_number", v)} />
                <Field label="CAP" value={form.postal_code} onChange={(v) => update("postal_code", v)} />
                <Field label="Città" value={form.city} onChange={(v) => update("city", v)} />
                <Field label="Provincia" value={form.province} onChange={(v) => update("province", v)} />
                <Field label="Nazione" value={form.country} onChange={(v) => update("country", v)} />
                <Select label="Tipo documento" value={form.document_type} onChange={(v) => update("document_type", v)} options={["", "Carta identità", "Patente", "Passaporto"]} />
                <Field label="Numero documento" value={form.document_number} onChange={(v) => update("document_number", v)} />
                <Field label="Scadenza documento" type="date" value={form.document_expires_at} onChange={(v) => update("document_expires_at", v)} />
              </div>
              <CustomerDocumentRows customer={{ medical_certificate_start_date: form.medical_certificate_start_date, medical_certificate_end_date: form.medical_certificate_end_date }} pendingDocuments={pendingDocuments} onPendingChange={updatePendingDocument} />
            </div>}

            {activeStep === 2 && <div className="platinum-step-stack">
              <div className="platinum-field-grid">
                <Select label="Abbonamento" value={form.subscription_plan} onChange={(v) => update("subscription_plan", v)} options={plans.map((plan) => plan.id)} labels={Object.fromEntries(plans.map((plan) => [plan.id, `${plan.name}${plan.price ? ` - EUR ${plan.price}` : ""}`]))} />
                <Select label="Metodo pagamento" value={form.payment_method} onChange={(v) => update("payment_method", v)} options={paymentMethods.map((method) => method.id)} labels={Object.fromEntries(paymentMethods.map((method) => [method.id, method.label]))} />
              </div>
              <div className="platinum-money-strip"><span>Quota associativa <strong>EUR {membershipAmount}</strong></span><span>Abbonamento <strong>EUR {selectedPlan.price}</strong></span><span>Totale <strong>EUR {totalAmount}</strong></span></div>
            </div>}

            {activeStep === 3 && <div className="platinum-step-stack">
              <div className="platinum-field-grid">
                <Field label="Inizio certificato" type="date" value={form.medical_certificate_start_date} onChange={(v) => update("medical_certificate_start_date", v)} />
                <Field label="Fine certificato" type="date" value={form.medical_certificate_end_date} onChange={(v) => update("medical_certificate_end_date", v)} />
                <Select label="Tipo accesso" value={form.access_type} onChange={(v) => update("access_type", v)} options={accessTypes.map((item) => item.id)} labels={Object.fromEntries(accessTypes.map((item) => [item.id, item.label]))} />
                <Field label="Codice badge / card RFID" value={form.badge_code} onChange={(v) => update("badge_code", v)} />
              </div>
              {form.badge_code.trim() ? <div className={badgePreview.controllerCode ? "bridge-preview" : "bridge-preview bridge-preview-warning"}><span>Codice bridge calcolato</span><b>{badgePreview.controllerCode || "Non derivabile"}</b>{badgePreview.warning ? <small>{badgePreview.warning}</small> : null}</div> : null}
              <label className="bg-check-row"><input type="checkbox" checked={form.privacy_consent} onChange={(e) => update("privacy_consent", e.target.checked)} /><span>Consenso privacy obbligatorio</span></label>
              <label className="bg-check-row"><input type="checkbox" checked={form.marketing_consent} onChange={(e) => update("marketing_consent", e.target.checked)} /><span>Consenso marketing</span></label>
              <label className="bg-check-row"><input type="checkbox" checked={form.photo_video_consent} onChange={(e) => update("photo_video_consent", e.target.checked)} /><span>Consenso foto e video</span></label>
            </div>}

            {activeStep === 4 && <div className="platinum-final-list">
              {summaryItems.map((item) => <SummaryRow key={item.label} item={item} />)}
            </div>}
          </section>
        </div>

        <aside className="platinum-summary-panel" aria-label="Riepilogo onboarding">
          <div className="summary-compact-title">Riepilogo</div>
          <div className="summary-compact-line"><span>Cliente</span><strong>{form.first_name || form.last_name ? `${form.first_name} ${form.last_name}`.trim() : "Da inserire"}</strong></div>
          <div className="summary-compact-line"><span>Sede</span><strong>{operationalBranch.name}</strong></div>
          <div className="summary-compact-line"><span>Abbonamento</span><strong>{selectedPlan.name}</strong></div>
          <div className="summary-compact-line"><span>Accesso</span><strong>{accessTypeLabel(form.access_type)}</strong></div>
          <div className="summary-compact-total">EUR {totalAmount}</div>
          <button type="button" className="summary-secondary" onClick={() => goToStep(4)}>Verifica finale</button>
        </aside>
      </form>

      <BGStickyActions className="platinum-onboarding-actions">
        <BGButton type="button" variant="secondary" disabled={activeStep === 0 || saving} onClick={() => goToStep(Math.max(0, activeStep - 1))}>Indietro</BGButton>
        <BGButton type="button" disabled={saving} onClick={primaryAction}>{activeStep === onboardingSteps.length - 1 ? saving ? "Creazione in corso…" : "Crea cliente e apri contratto" : "Continua"}</BGButton>
      </BGStickyActions>
    </main>
  );
}

function SummaryRow({ item }: { item: { label: string; value: string; status: OnboardingStatus } }) {
  const tone = item.status === "completed" ? "success" : item.status === "recoverable" ? "danger" : item.status === "not_required" ? "neutral" : "warning";
  const label = item.status === "completed" ? "Completato" : item.status === "recoverable" ? "Fallito ma recuperabile" : item.status === "not_required" ? "Non richiesto" : "Da completare";
  return <div className="platinum-summary-row"><div><strong>{item.label}</strong><span>{item.value}</span></div><BGStatusBadge tone={tone}>{label}</BGStatusBadge></div>;
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
