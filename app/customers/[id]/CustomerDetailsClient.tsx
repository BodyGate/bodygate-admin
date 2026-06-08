"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { supabase } from "../../lib/supabaseClient";
import CustomerPhotoUpload from "../components/CustomerPhotoUpload";
import MedicalCertificateCard from "../components/MedicalCertificateCard";
import CustomerTimeline from "../components/CustomerTimeline";
import CustomerPaymentsHistory from "../components/CustomerPaymentsHistory";
import CustomerReceiptsHistory from "../components/CustomerReceiptsHistory";

type Customer = any;
type Plan = any;
type CustomerTab =
  | "overview"
  | "profile"
  | "subscriptions"
  | "payments"
  | "access"
  | "documents"
  | "notes";


export default function CustomerDetailsClient({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [membershipFees, setMembershipFees] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [accessCredentials, setAccessCredentials] = useState<any[]>([]);
  const [dnakeUsers, setDnakeUsers] = useState<any[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrGenerating, setQrGenerating] = useState(false);
  const [mobilePassLoading, setMobilePassLoading] = useState(false);
  const [mobilePassUrl, setMobilePassUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<CustomerTab>("overview");

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [newNote, setNewNote] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    const activeQrPayload =
      dnakeUsers.find((item) => item.qr_status === "active" && item.qr_payload)
        ?.qr_payload || "";

    if (!activeQrPayload) {
      Promise.resolve().then(() => setQrDataUrl(""));
      return;
    }

    QRCode.toDataURL(activeQrPayload, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [dnakeUsers]);

  const customerName =
    `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() ||
    "Cliente senza nome";

  const initials =
    `${customer?.first_name?.[0] || ""}${customer?.last_name?.[0] || ""}`.toUpperCase() ||
    "BG";

  const bodyGatePublicUrl =
    process.env.NEXT_PUBLIC_BODYGATE_PUBLIC_URL || "https://bodygate-admin.vercel.app";

  const normalizedPhone = String(customer?.phone || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");

  const whatsAppPhone = normalizedPhone
    ? normalizedPhone.startsWith("39")
      ? normalizedPhone
      : `39${normalizedPhone}`
    : "";

  function startEditCustomer() {
    if (!customer) return;

    setEditForm({
      first_name: customer.first_name || "",
      last_name: customer.last_name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      fiscal_code: customer.fiscal_code || "",
      birth_date: customer.birth_date || "",
      gender: customer.gender || "",
      address: customer.address || "",
      city: customer.city || "",
      postal_code: customer.postal_code || customer.zip || "",
      emergency_contact_name: customer.emergency_contact_name || "",
      emergency_contact_phone: customer.emergency_contact_phone || "",
      reception_notes: customer.reception_notes || "",
      badge_code: customer.badge_code || "",
      controller_code: customer.controller_code || "",
      is_active: customer.is_active !== false,
    });

    setIsEditingCustomer(true);
  }

  function cancelEditCustomer() {
    setIsEditingCustomer(false);
    setEditForm({});
  }

  function updateEditField(field: string, value: any) {
    setEditForm((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function saveCustomerProfile() {
    if (!customer?.id) return;

    const firstName = String(editForm.first_name || "").trim();
    const lastName = String(editForm.last_name || "").trim();

    if (!firstName || !lastName) {
      alert("Nome e cognome sono obbligatori.");
      return;
    }

    setSavingCustomer(true);

    const payload = {
      first_name: firstName,
      last_name: lastName,
      phone: String(editForm.phone || "").trim() || null,
      email: String(editForm.email || "").trim() || null,
      fiscal_code: String(editForm.fiscal_code || "").trim() || null,
      birth_date: editForm.birth_date || null,
      gender: editForm.gender || null,
      address: String(editForm.address || "").trim() || null,
      city: String(editForm.city || "").trim() || null,
      postal_code: String(editForm.postal_code || "").trim() || null,
      emergency_contact_name: String(editForm.emergency_contact_name || "").trim() || null,
      emergency_contact_phone: String(editForm.emergency_contact_phone || "").trim() || null,
      reception_notes: String(editForm.reception_notes || "").trim() || null,
      badge_code: String(editForm.badge_code || "").trim() || null,
      controller_code: String(editForm.controller_code || "").trim() || null,
      is_active: !!editForm.is_active,
    };

    try {
      const response = await fetch("/api/customers/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customer.id,
          profile: payload,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        console.error("saveCustomerProfile API error", result);
        alert(
          "Errore salvataggio anagrafica: " +
            (result?.error || result?.detail?.message || "Errore sconosciuto")
        );
        return;
      }

      setIsEditingCustomer(false);
      await loadAll();
      alert("Anagrafica cliente aggiornata correttamente.");
    } catch (error: any) {
      console.error("saveCustomerProfile failed", error);
      alert(error?.message || "Errore imprevisto durante il salvataggio.");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .maybeSingle();

      if (customerError || !customerData) {
        const diagnostic = {
          customerId,
          found: !!customerData,
          supabaseError: customerError
            ? {
                message: customerError.message,
                details: customerError.details,
                hint: customerError.hint,
                code: customerError.code,
              }
            : null,
        };

        console.error("BODYGATE CUSTOMER LOAD ERROR", diagnostic);

        setErrorMessage(
          `Cliente non trovato o bloccato dalla lettura Supabase. Dettaglio: ${JSON.stringify(
            diagnostic,
            null,
            2
          )}`
        );

        setCustomer(null);
        return;
      }

      setCustomer(customerData);

      let plansQuery = supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (customerData.branch_id) {
        plansQuery = plansQuery.eq("branch_id", customerData.branch_id);
      }

      const { data: plansData } = await plansQuery;
      setPlans(plansData || []);

      const { data: subs } = await supabase
        .from("customer_subscriptions")
        .select("*, subscription_plans(name)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      setSubscriptions(subs || []);

      const { data: fees } = await supabase
        .from("customer_membership_fees")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      setMembershipFees(fees || []);

      const { data: blockList } = await supabase
        .from("customer_blocks")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      setBlocks(blockList || []);

      const { data: noteList } = await supabase
        .from("customer_internal_notes")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      setNotes(noteList || []);

      const { data: logs } = await supabase
        .from("customer_access_logs")
        .select("*")
        .eq("customer_id", customerId)
        .order("access_time", { ascending: false })
        .limit(50);

      setAccessLogs(logs || []);

      const { data: credentials } = await supabase
        .from("access_credentials")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      setAccessCredentials(credentials || []);

      const { data: dnakeList } = await supabase
        .from("customer_dnake_users")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      setDnakeUsers(dnakeList || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Errore imprevisto durante il caricamento.");
    } finally {
      setLoading(false);
    }
  }

  const activeSubscription = useMemo(() => {
    return subscriptions.find(
      (s) => s.is_active && s.starts_at <= today && s.ends_at >= today
    );
  }, [subscriptions, today]);

  const activeMembership = useMemo(() => {
    return membershipFees.find(
      (f) => f.valid_from <= today && f.valid_until >= today
    );
  }, [membershipFees, today]);

  const activeBlock = useMemo(() => {
    return blocks.find(
      (b) => b.is_active && (!b.ends_at || new Date(b.ends_at) >= new Date())
    );
  }, [blocks]);

  const medicalCertificateEnd =
    customer?.medical_certificate_end_date || customer?.medical_certificate_end;

  const certificateValid = medicalCertificateEnd && medicalCertificateEnd >= today;

  const accessAllowed =
    !!activeSubscription &&
    !!activeMembership &&
    !!certificateValid &&
    !activeBlock &&
    !!customer?.is_active;

  const customerInfo = [
    { label: "Telefono", value: customer?.phone || "-" },
    { label: "Email", value: customer?.email || "-" },
    { label: "Codice fiscale", value: customer?.fiscal_code || "-" },
    { label: "Data nascita", value: customer?.birth_date || "-" },
    { label: "Sesso", value: customer?.gender || "-" },
    { label: "Indirizzo", value: customer?.address || "-" },
    { label: "Città", value: customer?.city || "-" },
    { label: "CAP", value: customer?.postal_code || customer?.zip || "-" },
    { label: "Emergenza", value: customer?.emergency_contact_name || "-" },
    { label: "Tel. emergenza", value: customer?.emergency_contact_phone || "-" },
  ];

  const cardCredentials = useMemo(() => {
    return accessCredentials.filter((item) => item.type === "card" || item.type === "nfc");
  }, [accessCredentials]);

  const qrCredentials = useMemo(() => {
    return accessCredentials.filter((item) => item.type === "qr");
  }, [accessCredentials]);

  const activeDnakeQr = useMemo(() => {
    return dnakeUsers.find((item) => item.qr_status === "active") || dnakeUsers[0] || null;
  }, [dnakeUsers]);


  function paymentMethodLabel(method: string) {
  if (method === "cash") return "Contanti";
  if (method === "pos") return "POS";
  if (method === "bank_transfer") return "Bonifico";
  return "Contanti";
}

  async function renewMembershipFee() {
  if (!customer?.id) {
    alert("Cliente non caricato.");
    return;
  }

  const confirmed = window.confirm(
    "Confermi il rinnovo della quota associativa annuale (€10)?"
  );

  if (!confirmed) return;

  try {
    const response = await fetch("/api/payments/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: customer.id,
        paymentType: "membership_fee",
        amount: 10,
        description: "Quota associativa annuale",
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      alert(result.error || "Errore rinnovo quota associativa.");
      return;
    }

    await loadAll();

    alert("Quota associativa rinnovata correttamente.");
  } catch (error) {
    console.error(error);
    alert("Errore imprevisto.");
  }
}

  async function renewSubscription(planIdOverride?: string) {
    if (!customer?.id) return alert("Cliente non caricato.");

    const targetPlanId = planIdOverride || selectedPlanId;
    if (!targetPlanId) return alert("Seleziona un abbonamento.");

    const plan = plans.find((p) => p.id === targetPlanId);
    if (!plan) return alert("Piano non trovato.");

    const confirmed = window.confirm(
  `Confermi rinnovo ${plan.name}?\n\n` +
    `Importo: € ${Number(plan.promo_price || plan.price || 0).toFixed(2)}\n` +
    `Durata: ${Number(plan.duration_days || 0)} giorni\n` +
    `Pagamento: ${paymentMethodLabel(selectedPaymentMethod)}\n\n` +
    `Verranno creati automaticamente:\n` +
    `- Abbonamento\n` +
    `- Pagamento\n` +
    `- Ricevuta in duplice copia`
);

    if (!confirmed) return;

    try {
      const res = await fetch("/api/customers/renew-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customer.id,
          plan_id: targetPlanId,
          payment_method: selectedPaymentMethod,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        console.error("renew-subscription error", json);
        alert(json?.error || "Errore rinnovo abbonamento.");
        return;
      }

      if (json.print_url) {
        const receiptWindow = window.open(json.print_url, "_blank");

        if (receiptWindow === null) {
          alert(
            "Rinnovo completato, ma il browser ha bloccato l'apertura della ricevuta. Aprila dallo storico pagamenti."
          );
        } else {
          alert(
            `Rinnovo completato.\n\n` +
              `Cliente: ${json.customer_name || ""}\n` +
              `Piano: ${json.plan?.name || plan.name}\n` +
              `Ricevuta: ${json.receipt?.receipt_number || "creata"}`
          );
        }
      } else {
        alert(
          `Rinnovo completato.\n\n` +
            `Cliente: ${json.customer_name || ""}\n` +
            `Piano: ${json.plan?.name || plan.name}\n` +
            `Ricevuta: ${json.receipt?.receipt_number || "creata"}`
        );
      }

      await loadAll();
    } catch (error) {
      console.error("renewSubscription failed", error);
      alert("Errore imprevisto durante il rinnovo abbonamento.");
    }
  }

  

  async function addNote() {
  if (!customer?.id) {
    alert("Cliente non caricato.");
    return;
  }

  if (!newNote.trim()) {
    alert("Scrivi una nota.");
    return;
  }

  const response = await fetch("/api/customers/add-note", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerId: customer.id,
      note: newNote,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    alert(result.error || "Errore aggiunta nota.");
    return;
  }

  setNewNote("");
  await loadAll();
}

async function addBlock() {
  if (!customer?.id) {
    alert("Cliente non caricato.");
    return;
  }

  if (!blockReason.trim()) {
    alert("Inserisci il motivo del blocco.");
    return;
  }

  const response = await fetch("/api/customers/add-block", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerId: customer.id,
      reason: blockReason,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    alert(result.error || "Errore aggiunta blocco.");
    return;
  }

  setBlockReason("");
  await loadAll();
}

async function disableBlock(blockId: string) {
  if (!customer?.id) {
    alert("Cliente non caricato.");
    return;
  }

  const response = await fetch("/api/customers/disable-block", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerId: customer.id,
      blockId,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    alert(result.error || "Errore disattivazione blocco.");
    return;
  }

  await loadAll();
}



  async function generateDnakeQr() {
    if (!customerId) return;

    const confirmed =
      activeDnakeQr ||
      window.confirm(
        "Vuoi generare un nuovo utente/QR DNake per questo cliente?"
      );

    if (!confirmed) return;

    setQrGenerating(true);

    try {
      const response = await fetch("/api/dnake/create-user-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customerId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        alert(
          "Errore generazione QR DNake: " +
            (result?.error || result?.response || "Errore sconosciuto")
        );
        return;
      }

      await loadAll();
      alert("QR DNake generato correttamente.");
    } catch (error: any) {
      alert("Errore generazione QR DNake: " + (error?.message || "Errore sconosciuto"));
    } finally {
      setQrGenerating(false);
    }
  }


  async function createOrGetMobilePass() {
    if (!customer?.id) {
      alert("Cliente non caricato.");
      return "";
    }

    setMobilePassLoading(true);

    try {
      const response = await fetch("/api/customers/create-mobile-pass", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customer.id,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        console.error("create-mobile-pass error", result);
        alert(result?.error || "Errore creazione Mobile Pass.");
        return "";
      }

      const url = `${bodyGatePublicUrl}${result.mobile_url}`;
      setMobilePassUrl(url);
      return url;
    } catch (error: any) {
      console.error("createOrGetMobilePass failed", error);
      alert(error?.message || "Errore imprevisto durante la creazione del Mobile Pass.");
      return "";
    } finally {
      setMobilePassLoading(false);
    }
  }

  async function sendMobilePassWhatsApp() {
    const url = mobilePassUrl || (await createOrGetMobilePass());
    if (!url) return;

    const message =
      `Ciao ${customer?.first_name || ""}, ecco il tuo BodyGate Mobile Pass di Body Energy:\n\n` +
      `${url}\n\n` +
      `Aprilo dal telefono e mostralo al lettore QR all'ingresso. ` +
      `Puoi anche salvarlo sulla schermata Home come app.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = whatsAppPhone
      ? `https://wa.me/${whatsAppPhone}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank");
  }

  async function copyMobilePassLink() {
    const url = mobilePassUrl || (await createOrGetMobilePass());
    if (!url) return;

    await navigator.clipboard.writeText(url);
    alert("Link Mobile Pass copiato.");
  }

  function printQr() {
    if (!qrDataUrl || !customer) return;

    const win = window.open("", "_blank", "width=420,height=640");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>QR DNake - ${customerName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: #ffffff;
              color: #111111;
              text-align: center;
              padding: 32px;
            }
            .card {
              border: 1px solid #dddddd;
              border-radius: 18px;
              padding: 28px;
              max-width: 340px;
              margin: 0 auto;
            }
            h1 {
              font-size: 22px;
              margin: 0 0 8px;
            }
            p {
              color: #555555;
              margin: 6px 0;
            }
            img {
              width: 260px;
              height: 260px;
              margin: 20px 0;
            }
            .small {
              font-size: 12px;
              word-break: break-all;
            }
      </style>
        </head>
        <body>
          <div class="card">
            <h1>${customerName}</h1>
            <p>QR Accesso BodyGate / DNake</p>
            <img src="${qrDataUrl}" />
            <p>ID DNake: ${activeDnakeQr?.dnake_user_id || "-"}</p>
            <p class="small">${activeDnakeQr?.qr_payload || ""}</p>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    win.document.close();
  }

  function openTab(tab: CustomerTab) {
    setActiveTab(tab);
  }

  const tabs: { id: CustomerTab; label: string }[] = [
    { id: "overview", label: "Panoramica" },
    { id: "profile", label: "Profilo" },
    { id: "subscriptions", label: "Abbonamenti" },
    { id: "payments", label: "Pagamenti & Ricevute" },
    { id: "access", label: "Accessi" },
    { id: "documents", label: "Documenti" },
    { id: "notes", label: "Note & Timeline" },
  ];

  const lastAccess = accessLogs[0];
  const latestNotes = notes.slice(0, 3);
  const latestTimelineEvents = [...subscriptions, ...membershipFees, ...blocks, ...notes]
    .map((item) => ({
      id: item.id,
      title:
        item.note ||
        item.reason ||
        item.subscription_plans?.name ||
        (item.valid_until ? "Quota associativa" : "Evento cliente"),
      date: item.created_at || item.starts_at || item.valid_from,
    }))
    .filter((item) => item.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 3);

  function renderCommandAction(tab: CustomerTab, children: ReactNode, variant: "primary" | "secondary" | "danger" = "secondary") {
    return (
      <button type="button" className={`command-action ${variant}`} onClick={() => openTab(tab)}>
        {children}
      </button>
    );
  }

  const renderEditPanel = () =>
    isEditingCustomer ? (
      <div className="edit-panel">
        <div className="edit-panel-header">
          <div>
            <div className="edit-panel-title">Modifica anagrafica</div>
            <div className="muted">Dati cliente, credenziali e stato attività.</div>
          </div>

          <div className="actions actions-inline">
            <button type="button" className="secondary-btn" onClick={cancelEditCustomer} disabled={savingCustomer}>
              Annulla
            </button>
            <button type="button" onClick={saveCustomerProfile} disabled={savingCustomer}>
              {savingCustomer ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </div>

        <div className="edit-form-grid bg-form-grid bg-form-grid-3">
          <EditField label="Nome" value={editForm.first_name || ""} onChange={(value) => updateEditField("first_name", value)} />
          <EditField label="Cognome" value={editForm.last_name || ""} onChange={(value) => updateEditField("last_name", value)} />
          <EditField label="Telefono" value={editForm.phone || ""} onChange={(value) => updateEditField("phone", value)} />
          <EditField label="Email" type="email" value={editForm.email || ""} onChange={(value) => updateEditField("email", value)} />
          <EditField label="Codice fiscale" value={editForm.fiscal_code || ""} onChange={(value) => updateEditField("fiscal_code", value.toUpperCase())} />
          <EditField label="Data nascita" type="date" value={editForm.birth_date || ""} onChange={(value) => updateEditField("birth_date", value)} />

          <div className="edit-field bg-form-field">
            <label>Sesso</label>
            <select value={editForm.gender || ""} onChange={(e) => updateEditField("gender", e.target.value)}>
              <option value="">Non specificato</option>
              <option value="M">Maschile</option>
              <option value="F">Femminile</option>
              <option value="ALTRO">Altro</option>
            </select>
          </div>

          <EditField label="Indirizzo" value={editForm.address || ""} onChange={(value) => updateEditField("address", value)} />
          <EditField label="Città" value={editForm.city || ""} onChange={(value) => updateEditField("city", value)} />
          <EditField label="CAP" value={editForm.postal_code || ""} onChange={(value) => updateEditField("postal_code", value)} />
          <EditField label="Contatto emergenza" value={editForm.emergency_contact_name || ""} onChange={(value) => updateEditField("emergency_contact_name", value)} />
          <EditField label="Telefono emergenza" value={editForm.emergency_contact_phone || ""} onChange={(value) => updateEditField("emergency_contact_phone", value)} />
          <EditField label="Badge principale" value={editForm.badge_code || ""} onChange={(value) => updateEditField("badge_code", value)} />
          <EditField label="Controller code" value={editForm.controller_code || ""} onChange={(value) => updateEditField("controller_code", value)} />

          <div className="edit-field bg-form-field">
            <label>Stato cliente</label>
            <div className="checkbox-field">
              <input type="checkbox" checked={!!editForm.is_active} onChange={(e) => updateEditField("is_active", e.target.checked)} />
              <span>{editForm.is_active ? "Cliente attivo" : "Cliente disattivato"}</span>
            </div>
          </div>

          <div className="edit-field bg-form-field edit-field-full">
            <label>Note reception</label>
            <textarea value={editForm.reception_notes || ""} onChange={(e) => updateEditField("reception_notes", e.target.value)} placeholder="Note rapide per la reception..." />
          </div>
        </div>
      </div>
    ) : null;

  const renderStatusStrip = () => (
    <div className="status-strip">
      <StatusPill label="Abbonamento" ok={!!activeSubscription} value={activeSubscription ? `fino al ${activeSubscription.ends_at}` : "scaduto"} />
      <StatusPill label="Certificato" ok={!!certificateValid} value={certificateValid ? `fino al ${medicalCertificateEnd}` : "mancante"} />
      <StatusPill label="Quota" ok={!!activeMembership} value={activeMembership ? `fino al ${activeMembership.valid_until}` : "scaduta"} />
      <StatusPill label="Ultimo accesso" ok={!!lastAccess?.was_allowed} value={lastAccess ? new Date(lastAccess.access_time).toLocaleString() : "nessuno"} />
    </div>
  );

  const renderCredentials = () => (
    <div className="card credentials-card bg-card-premium">
      <div className="section-heading">
        <div>
          <h2>Credenziali accesso</h2>
          <p>RFID, QR DNake e Mobile Pass.</p>
        </div>
        <span className={`mini-badge ${activeDnakeQr ? "ok" : "ko"}`}>{activeDnakeQr ? "QR attivo" : "QR assente"}</span>
      </div>

      <div className="credential-summary">
        <div className="credential-mini">
          <div className="credential-mini-label">RFID / NFC</div>
          <div className="credential-mini-value">{cardCredentials.length}</div>
        </div>
        <div className="credential-mini">
          <div className="credential-mini-label">Credenziali QR</div>
          <div className="credential-mini-value">{qrCredentials.length}</div>
        </div>
      </div>

      <div className="credential-section">
        <div className="credential-section-title">Tessere / Card</div>
        {cardCredentials.length === 0 ? (
          <p className="empty">Nessuna tessera associata.</p>
        ) : (
          <div className="credential-pill-list">
            {cardCredentials.map((item) => (
              <span className="credential-pill" key={item.id}>
                {String(item.type).toUpperCase()} · {item.controller_code || item.code}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="credential-section">
        <div className="credential-section-title">QR Code DNake</div>
        {activeDnakeQr ? (
          <>
            {qrDataUrl ? (
              <div className="qr-box"><img src={qrDataUrl} alt="QR DNake" /></div>
            ) : (
              <p className="empty">Generazione immagine QR...</p>
            )}
            <div className="qr-meta">
              <div><strong>ID DNake:</strong> {activeDnakeQr.dnake_user_id}</div>
              <div><strong>Nome DNake:</strong> {activeDnakeQr.dnake_name}</div>
              <div><strong>Stato:</strong> {activeDnakeQr.qr_status}</div>
            </div>
            <div className="actions">
              <button className="secondary-btn" type="button" onClick={printQr} disabled={!qrDataUrl}>Visualizza / stampa</button>
              <button type="button" onClick={generateDnakeQr} disabled={qrGenerating}>{qrGenerating ? "Rigenero..." : "Rigenera QR"}</button>
            </div>
          </>
        ) : (
          <>
            <p className="empty">Nessun QR DNake generato.</p>
            <button type="button" onClick={generateDnakeQr} disabled={qrGenerating}>{qrGenerating ? "Generazione..." : "Genera QR DNake"}</button>
          </>
        )}
      </div>

      <div className="credential-section mobile-pass-section">
        <div className="credential-section-title">Mobile Pass / WhatsApp</div>
        {mobilePassUrl ? <div className="mobile-pass-url">{mobilePassUrl}</div> : null}
        <div className="actions">
          <button type="button" className="secondary-btn" onClick={createOrGetMobilePass} disabled={mobilePassLoading}>{mobilePassLoading ? "Creo link..." : "Genera Pass Mobile"}</button>
          <button type="button" onClick={sendMobilePassWhatsApp} disabled={mobilePassLoading}>Invia WhatsApp</button>
          <button type="button" className="secondary-btn" onClick={copyMobilePassLink} disabled={mobilePassLoading}>Copia link</button>
        </div>
        {!customer?.phone ? <div className="qr-meta danger-text qr-meta-warning">Telefono mancante: WhatsApp si aprirà senza destinatario.</div> : null}
      </div>
    </div>
  );

  const renderSubscriptionTools = () => (
    <>
      <div className="card accent-card">
        <div className="section-heading">
          <div>
            <h2>Rinnovo rapido + pagamento</h2>
            <p>Rinnova usando i flussi esistenti.</p>
          </div>
          <button onClick={renewMembershipFee}>Rinnova quota 10€</button>
        </div>

        <div className="payment-method-box">
          <div className="small-muted">Metodo pagamento</div>
          <select value={selectedPaymentMethod} onChange={(e) => setSelectedPaymentMethod(e.target.value)}>
            <option value="cash">Contanti</option>
            <option value="pos">POS</option>
            <option value="bank_transfer">Bonifico</option>
          </select>
        </div>

        <div className="quick-plan-grid">
          {plans.map((plan) => {
            const price = Number(plan.promo_price || plan.price || 0);
            const duration = Number(plan.duration_days || 0);
            return (
              <button key={plan.id} type="button" className="quick-plan-btn" onClick={() => renewSubscription(plan.id)}>
                <span className="plan-duration-badge">{duration} giorni</span>
                <span className="quick-plan-title">{plan.name}</span>
                <strong className="quick-plan-price">€ {price.toFixed(2)}</strong>
              </button>
            );
          })}
        </div>

        <div className="manual-renew-box">
          <div className="small-muted">Rinnovo manuale / piano personalizzato</div>
          <div className="actions">
            <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
              <option value="">Seleziona piano</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name} - €{Number(plan.promo_price || plan.price || 0).toFixed(2)} - {plan.duration_days} giorni</option>
              ))}
            </select>
            <button className="secondary-btn" onClick={() => renewSubscription()}>Rinnova</button>
          </div>
        </div>
      </div>

      <div className="grid">
        <HistoryCard title="Storico abbonamenti">
          {subscriptions.length === 0 && <p className="empty">Nessun abbonamento.</p>}
          {subscriptions.map((sub) => (
            <InfoRow key={sub.id} title={sub.subscription_plans?.name || "Abbonamento"} subtitle={`${sub.starts_at} → ${sub.ends_at}`} right={`€ ${sub.amount}`} />
          ))}
        </HistoryCard>

        <HistoryCard title="Storico quota associativa">
          {membershipFees.length === 0 && <p className="empty">Nessuna quota registrata.</p>}
          {membershipFees.map((fee) => (
            <InfoRow key={fee.id} title={`Quota € ${fee.amount}`} subtitle={`${fee.valid_from} → ${fee.valid_until}`} right={fee.payment_method || ""} />
          ))}
        </HistoryCard>
      </div>
    </>
  );

  const renderBlocks = () => (
    <div className="card">
      <div className="section-heading">
        <div>
          <h2>Blocchi cliente</h2>
          <p>Gestione blocco/sblocco reception.</p>
        </div>
        <span className={`mini-badge ${activeBlock ? "ko" : "ok"}`}>{activeBlock ? "Bloccato" : "Libero"}</span>
      </div>
      <div className="actions">
        <input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Motivo blocco..." />
        <button onClick={addBlock}>Blocca</button>
      </div>
      {blocks.length === 0 && <p className="empty">Nessun blocco presente.</p>}
      {blocks.map((block) => (
        <div className="row" key={block.id}>
          <div>
            <div className="row-title">{block.reason}</div>
            <div className="row-subtitle">{block.is_active ? "Attivo" : "Disattivato"}</div>
          </div>
          {block.is_active && <button className="secondary-btn" onClick={() => disableBlock(block.id)}>Sblocca</button>}
        </div>
      ))}
    </div>
  );

  const renderAccessRows = (items: any[]) => (
    <div className="compact-list">
      {items.length === 0 && <p className="empty">Nessun accesso registrato.</p>}
      {items.map((log) => (
        <div className="access-row" key={log.id}>
          <span className={`mini-badge ${log.was_allowed ? "ok" : "ko"}`}>{log.was_allowed ? "Consentito" : "Negato"}</span>
          <div>
            <strong>{new Date(log.access_time).toLocaleString()}</strong>
            <p>{log.reason || "Varco palestra"}</p>
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="customer-page bg-page-shell">
        <div className="loading-card">Caricamento cliente...</div>
      </div>
    );
  }

  if (errorMessage || !customer) {
    return (
      <div className="customer-page bg-page-shell">
        <div className="error-card">
          <h2>Cliente non caricato</h2>
          <pre className="error-details">{errorMessage}</pre>
          <small>ID: {customerId}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-page bg-page-shell">
      <style jsx>{`
        .customer-page { padding: 32px; color: #fff; background: #050505; min-height: 100vh; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; gap: 16px; }
        .back-link, .command-action { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 10px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,.12); color: #f5f5f5; background: rgba(255,255,255,.06); text-decoration: none; font-size: 13px; font-weight: 950; transition: .18s ease; cursor: pointer; }
        .back-link:hover, .command-action:hover, button:hover { transform: translateY(-1px); border-color: rgba(239,68,68,.36); }
        .command-center { background: radial-gradient(circle at top left, rgba(239,68,68,.24), transparent 33%), linear-gradient(145deg, rgba(255,255,255,.09), rgba(255,255,255,.025)), rgba(9,9,11,.96); border: 1px solid rgba(255,255,255,.11); border-radius: 32px; padding: 26px; box-shadow: 0 28px 90px rgba(0,0,0,.46); margin-bottom: 18px; }
        .command-main { display: grid; grid-template-columns: 1fr auto; gap: 22px; align-items: start; }
        .profile-area { display: flex; gap: 18px; align-items: flex-start; min-width: 0; }
        .avatar, .avatar-placeholder { width: 92px; height: 92px; border-radius: 25px; flex-shrink: 0; }
        .avatar { object-fit: cover; border: 2px solid rgba(255,255,255,.14); }
        .avatar-placeholder { background: linear-gradient(135deg, #ef4444, #7f1d1d); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 950; }
        h1 { font-size: 34px; line-height: 1; margin: 0 0 10px; font-weight: 950; letter-spacing: -0.8px; }
        h2 { font-size: 20px; margin: 0; font-weight: 950; letter-spacing: -0.2px; }
        .muted, .section-heading p, .row-subtitle, .row-right, .small-muted, .access-row p { color: #a3a3a3; font-size: 13px; margin: 4px 0 0; }
        .contact-line, .badge-line, .command-actions, .actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .contact-line { margin-top: 8px; color: #d4d4d8; font-weight: 800; }
        .badge-line { margin-top: 12px; }
        .command-actions { justify-content: flex-end; max-width: 420px; }
        .command-action.primary, button { background: linear-gradient(135deg, #ef4444, #991b1b); border: 0; color: #fff; box-shadow: 0 16px 30px rgba(239,68,68,.18); }
        .command-action.danger { background: rgba(239,68,68,.12); color: #fecaca; border-color: rgba(239,68,68,.38); box-shadow: none; }
        .secondary-btn, .command-action.secondary { background: rgba(255,255,255,.07); color: #f5f5f5; border: 1px solid rgba(255,255,255,.13); box-shadow: none; }
        .badge-status, .mini-badge { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-weight: 950; white-space: nowrap; }
        .badge-status { min-height: 42px; padding: 0 18px; font-size: 13px; }
        .mini-badge { padding: 7px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .45px; }
        .ok { background: rgba(34,197,94,.14); color: #4ade80; border: 1px solid rgba(34,197,94,.35); }
        .ko { background: rgba(239,68,68,.14); color: #fb7185; border: 1px solid rgba(239,68,68,.35); }
        .status-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }
        .status-pill, .card, .error-card, .loading-card, .overview-card { background: linear-gradient(145deg, rgba(255,255,255,.06), rgba(255,255,255,.02)), rgba(10,10,10,.9); border: 1px solid rgba(255,255,255,.10); border-radius: 24px; padding: 20px; box-shadow: 0 22px 60px rgba(0,0,0,.32); }
        .status-pill { min-height: 92px; display: grid; gap: 8px; }
        .status-label, .info-label, .credential-mini-label, .edit-field label, .overview-label { color: #737373; font-size: 11px; text-transform: uppercase; letter-spacing: .55px; font-weight: 950; }
        .status-value, .info-value, .credential-mini-value { font-size: 15px; font-weight: 950; word-break: break-word; }
        .tabs { display: flex; gap: 8px; overflow-x: auto; padding: 8px; border: 1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.035); border-radius: 20px; margin: 18px 0; }
        .tab-button { border: 1px solid transparent; background: transparent; color: #a3a3a3; box-shadow: none; min-height: 42px; padding: 0 15px; border-radius: 14px; font-weight: 950; white-space: nowrap; }
        .tab-button.active { color: #fff; background: linear-gradient(135deg, rgba(239,68,68,.85), rgba(127,29,29,.9)); border-color: rgba(255,255,255,.13); }
        .overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; align-items: stretch; }
        .overview-card { min-height: 180px; display: flex; flex-direction: column; gap: 12px; }
        .overview-value { font-size: 18px; font-weight: 950; line-height: 1.25; overflow-wrap: anywhere; }
        .overview-card .command-action { margin-top: auto; width: fit-content; }
        .grid, .tab-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; align-items: start; }
        .tab-stack, .side-stack, .compact-list { display: grid; gap: 16px; }
        .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
        .customer-info-grid { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 12px; }
        .info-mini-card, .credential-mini { display: grid; gap: 7px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: 18px; padding: 13px 14px; min-width: 0; }
        .row, .access-row { display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.035); border-radius: 18px; padding: 14px; gap: 14px; margin-top: 10px; }
        .access-row { justify-content: flex-start; margin-top: 0; }
        .row-title { font-weight: 950; word-break: break-word; }
        .empty { color: #9ca3af; font-size: 14px; padding: 16px; border: 1px dashed rgba(255,255,255,.12); border-radius: 16px; background: rgba(255,255,255,.025); text-align: center; }
        input, select, textarea { border-radius: 16px; border: 1px solid rgba(255,255,255,.11); padding: 13px 15px; font-size: 14px; outline: none; background: linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.025)), rgba(5,5,5,.92); color: #fff; width: 100%; font-family: inherit; font-weight: 800; min-height: 46px; }
        textarea { min-height: 96px; resize: vertical; }
        button { min-height: 42px; padding: 0 15px; border-radius: 14px; font-weight: 950; cursor: pointer; }
        button:disabled { cursor: not-allowed; opacity: .55; transform: none; }
        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, .back-link:focus-visible, .command-action:focus-visible { outline: 2px solid rgba(239,68,68,.76); outline-offset: 3px; }
        .edit-panel { margin-top: 22px; border: 1px solid rgba(239,68,68,.32); background: rgba(239,68,68,.055); border-radius: 22px; padding: 18px; }
        .edit-panel-header { display: flex; justify-content: space-between; gap: 14px; align-items: center; margin-bottom: 16px; }
        .edit-panel-title { font-size: 18px; font-weight: 950; }
        .edit-form-grid { display: grid; grid-template-columns: repeat(3, minmax(180px, 1fr)); gap: 14px; align-items: start; }
        .edit-field { display: grid; gap: 7px; min-width: 0; }
        .edit-field-full { grid-column: 1 / -1; }
        .checkbox-field { border: 1px solid #303030; border-radius: 14px; padding: 13px 15px; background: #050505; display: flex; align-items: center; gap: 10px; min-height: 47px; }
        .checkbox-field input { width: auto; accent-color: #ef4444; min-height: auto; }
        .checkbox-field span { font-weight: 950; }
        .credentials-card { border-color: rgba(239,68,68,.35); background: linear-gradient(180deg, #141414, #090909); }
        .credential-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
        .credential-section { border-top: 1px solid #262626; padding-top: 14px; margin-top: 14px; }
        .credential-section-title { color: #a3a3a3; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .65px; margin-bottom: 10px; }
        .credential-pill-list { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
        .credential-pill { border-radius: 999px; background: #050505; border: 1px solid #303030; padding: 8px 11px; font-size: 12px; font-weight: 850; }
        .qr-box { background: #fff; border-radius: 18px; padding: 14px; display: inline-flex; margin: 6px 0 12px; }
        .qr-box img { width: 210px; height: 210px; display: block; }
        .qr-meta { color: #a3a3a3; font-size: 13px; line-height: 1.7; word-break: break-word; }
        .danger-text { color: #fb7185; }
        .mobile-pass-section { border-top: 1px solid rgba(255,255,255,.08); padding-top: 18px; margin-top: 18px; }
        .mobile-pass-url { border: 1px solid rgba(59,130,246,.22); background: rgba(59,130,246,.08); color: #bfdbfe; border-radius: 14px; padding: 12px; font-size: 12px; line-height: 1.45; word-break: break-all; margin: 12px 0; }
        .qr-meta-warning { margin-top: 10px; }
        .payment-method-box, .manual-renew-box { margin-top: 14px; padding: 14px; border-radius: 18px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.035); }
        .quick-plan-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
        .quick-plan-btn { min-height: 130px; display: grid; align-content: center; gap: 8px; text-align: left; border-radius: 18px; padding: 16px; border: 1px solid rgba(255,255,255,.12); background: linear-gradient(180deg, rgba(239,68,68,.18), rgba(255,255,255,.055)); box-shadow: 0 16px 34px rgba(0,0,0,.2); white-space: normal; overflow-wrap: anywhere; }
        .quick-plan-title { font-size: 16px; font-weight: 950; line-height: 1.22; }
        .quick-plan-price { font-size: 25px; font-weight: 950; }
        .plan-duration-badge { width: fit-content; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 5px 8px; color: #fecaca; background: rgba(239,68,68,.13); font-size: 11px; font-weight: 950; }
        .error-details { white-space: pre-wrap; word-break: break-word; color: #fca5a5; background: #050505; border: 1px solid #262626; border-radius: 14px; padding: 14px; font-size: 13px; line-height: 1.5; }
        @media (max-width: 1200px) { .command-main, .status-strip, .overview-grid, .grid, .tab-grid, .edit-form-grid, .quick-plan-grid, .customer-info-grid { grid-template-columns: 1fr; } .command-actions { justify-content: flex-start; max-width: none; } .profile-area, .topbar, .edit-panel-header { flex-direction: column; align-items: stretch; } }
      `}</style>

      <div className="topbar">
        <Link className="back-link" href="/customers">← Torna ai clienti</Link>
      </div>

      <header className="command-center">
        <div className="command-main">
          <div className="profile-area">
            {customer?.photo_url ? <img className="avatar" src={customer.photo_url} alt={customerName} /> : <div className="avatar-placeholder">{initials}</div>}
            <div>
              <h1>{customerName}</h1>
              <div className="contact-line">
                <span>{customer.phone || "Telefono mancante"}</span>
                <span>·</span>
                <span>{customer.email || "Email mancante"}</span>
              </div>
              <div className="badge-line">
                <span className="mini-badge">Badge {customer.badge_code || "-"}</span>
                <span className="mini-badge">Controller {customer.controller_code || "-"}</span>
                <span className={`badge-status ${accessAllowed ? "ok" : "ko"}`}>{accessAllowed ? "Accesso attivo" : "Accesso bloccato"}</span>
              </div>
            </div>
          </div>

          <div className="command-actions">
            {renderCommandAction("subscriptions", "Rinnova", "primary")}
            {renderCommandAction("payments", "Nuovo incasso", "primary")}
            {renderCommandAction("payments", "Ricevute")}
            {renderCommandAction("access", "Accessi")}
            <button type="button" className="command-action secondary" onClick={() => { openTab("profile"); startEditCustomer(); }}>Modifica</button>
            {renderCommandAction("access", "Blocca", "danger")}
          </div>
        </div>
        {renderStatusStrip()}
      </header>

      <nav className="tabs" aria-label="Sezioni cliente">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={`tab-button ${activeTab === tab.id ? "active" : ""}`} onClick={() => openTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <div className="overview-grid">
          <OverviewCard label="Abbonamento" value={activeSubscription ? activeSubscription.subscription_plans?.name || "Attivo" : "Non attivo"} detail={activeSubscription ? `Scade ${activeSubscription.ends_at}` : "Rinnovo richiesto"} ok={!!activeSubscription} onOpen={() => openTab("subscriptions")} />
          <OverviewCard label="Quota associativa" value={activeMembership ? "Valida" : "Scaduta"} detail={activeMembership ? `Scade ${activeMembership.valid_until}` : "Da rinnovare"} ok={!!activeMembership} onOpen={() => openTab("subscriptions")} />
          <OverviewCard label="Certificato medico" value={certificateValid ? "Valido" : "Mancante"} detail={certificateValid ? `Scade ${medicalCertificateEnd}` : "Carica documento"} ok={!!certificateValid} onOpen={() => openTab("documents")} />
          <OverviewCard label="Pagamenti" value="Storico" detail="Incassi e annulli" ok onOpen={() => openTab("payments")} />
          <OverviewCard label="Ricevute" value="Archivio" detail="Visualizza / stampa" ok onOpen={() => openTab("payments")} />
          <OverviewCard label="Accessi" value={lastAccess ? (lastAccess.was_allowed ? "Ultimo consentito" : "Ultimo negato") : "Nessuno"} detail={lastAccess ? new Date(lastAccess.access_time).toLocaleString() : "Nessun log"} ok={!lastAccess || !!lastAccess.was_allowed} onOpen={() => openTab("access")} />
          <OverviewCard label="Note" value={`${notes.length} note`} detail={latestNotes[0]?.note || "Nessuna nota recente"} ok onOpen={() => openTab("notes")} />
          <div className="overview-card">
            <div className="overview-label">Timeline recente</div>
            <div className="compact-list">
              {latestTimelineEvents.length === 0 && <p className="empty">Nessun evento recente.</p>}
              {latestTimelineEvents.map((event) => <InfoRow key={event.id} title={event.title} subtitle={new Date(event.date).toLocaleString()} />)}
            </div>
            <button type="button" className="command-action secondary" onClick={() => openTab("notes")}>Apri</button>
          </div>
        </div>
      )}

      {activeTab === "profile" && (
        <div className="tab-grid">
          <div className="tab-stack">
            <div className="card">
              <div className="section-heading">
                <div><h2>Profilo cliente</h2><p>Anagrafica completa.</p></div>
                {!isEditingCustomer ? <button type="button" className="secondary-btn" onClick={startEditCustomer}>Modifica anagrafica</button> : null}
              </div>
              <div className="customer-info-grid">
                {customerInfo.map((item) => <div className="info-mini-card" key={item.label}><div className="info-label">{item.label}</div><div className="info-value">{item.value}</div></div>)}
              </div>
              {renderEditPanel()}
            </div>
          </div>
          <div className="side-stack">
            <CustomerPhotoUpload customerId={customer.id} currentPhotoUrl={customer.photo_url} onUploaded={(url) => setCustomer((prev: any) => ({ ...prev, photo_url: url }))} />
          </div>
        </div>
      )}

      {activeTab === "subscriptions" && <div className="tab-stack">{renderSubscriptionTools()}</div>}

      {activeTab === "payments" && (
        <div className="tab-stack">
          <CustomerPaymentsHistory customerId={customer.id} />
          <CustomerReceiptsHistory customerId={customer.id} />
        </div>
      )}

      {activeTab === "access" && (
        <div className="tab-grid">
          <div className="tab-stack">
            {renderCredentials()}
            {renderBlocks()}
          </div>
          <HistoryCard title="Storico accessi">
            {renderAccessRows(accessLogs)}
          </HistoryCard>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="tab-grid">
          <MedicalCertificateCard customerId={customer.id} currentCertificateUrl={customer.medical_certificate_url} startDate={customer.medical_certificate_start_date} endDate={customer.medical_certificate_end_date} onUpdated={(data) => setCustomer((prev: any) => ({ ...prev, medical_certificate_url: data.url, medical_certificate_start_date: data.startDate, medical_certificate_end_date: data.endDate }))} />
          <div className="card">
            <div className="section-heading"><div><h2>Documenti cliente</h2><p>Contratto e file collegati se presenti.</p></div></div>
            <InfoRow title="Certificato medico" subtitle={certificateValid ? `Valido fino al ${medicalCertificateEnd}` : "Mancante o scaduto"} right={certificateValid ? "OK" : "Da aggiornare"} />
            <InfoRow title="Contratto" subtitle={customer.contract_url ? "Link contratto disponibile" : "Nessun link contratto salvato"} right={customer.contract_url ? "Disponibile" : "-"} />
            {customer.contract_url ? <a className="command-action secondary" href={customer.contract_url} target="_blank" rel="noreferrer">Apri contratto</a> : null}
          </div>
        </div>
      )}

      {activeTab === "notes" && (
        <div className="tab-grid">
          <div className="card">
            <div className="section-heading"><div><h2>Note interne</h2><p>Annotazioni operative per lo staff.</p></div></div>
            <div className="actions">
              <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Scrivi una nota interna..." />
              <button className="secondary-btn" onClick={addNote}>Aggiungi</button>
            </div>
            {notes.length === 0 && <p className="empty">Nessuna nota interna.</p>}
            {notes.map((note) => <div className="row" key={note.id}><div><div className="row-title">{note.note}</div><div className="row-subtitle">{new Date(note.created_at).toLocaleString()}</div></div></div>)}
          </div>
          <CustomerTimeline customerId={customer.id} />
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="status-pill">
      <div className="status-label">{label}</div>
      <div className={`status-value ${ok ? "success-text" : "danger-text"}`}>{value}</div>
    </div>
  );
}

function OverviewCard({ label, value, detail, ok, onOpen }: { label: string; value: string; detail: string; ok: boolean; onOpen: () => void }) {
  return (
    <div className="overview-card">
      <div className="overview-label">{label}</div>
      <span className={`mini-badge ${ok ? "ok" : "ko"}`}>{ok ? "OK" : "Attenzione"}</span>
      <div className="overview-value">{value}</div>
      <p className="muted">{detail}</p>
      <button type="button" className="command-action secondary" onClick={onOpen}>Gestisci</button>
    </div>
  );
}

function EditField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="edit-field bg-form-field">
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function HistoryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="section-heading"><div><h2>{title}</h2></div></div>
      {children}
    </div>
  );
}

function InfoRow({ title, subtitle, right }: { title: string; subtitle: string; right?: string }) {
  return (
    <div className="row">
      <div>
        <div className="row-title">{title}</div>
        <div className="row-subtitle">{subtitle}</div>
      </div>
      {right ? <div className="row-right">{right}</div> : null}
    </div>
  );
}
