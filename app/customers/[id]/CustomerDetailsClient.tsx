"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { supabase } from "../../lib/supabaseClient";
import CustomerPhotoUpload from "../components/CustomerPhotoUpload";
import MedicalCertificateCard from "../components/MedicalCertificateCard";
import CustomerTimeline from "../components/CustomerTimeline";
import CustomerPaymentsHistory from "../components/CustomerPaymentsHistory";
import CustomerReceiptsHistory from "../components/CustomerReceiptsHistory";
import BGButton from "../../components/ui/BGButton";
import BGCard from "../../components/ui/BGCard";
import BGEmptyState from "../../components/ui/BGEmptyState";
import BGSectionHeader from "../../components/ui/BGSectionHeader";
import BGStatusBadge from "../../components/ui/BGStatusBadge";
import BGPremiumSectionNav from "../../components/ui/BGPremiumSectionNav";

type Customer = any;
type Plan = any;
type SectionKey =
  | "overview"
  | "profile"
  | "subscriptions"
  | "payments"
  | "access"
  | "documents"
  | "timeline";

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
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");

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

  if (loading) {
    return (
      <div className="customer-page bg-page-shell">
        <BGCard variant="premium">Caricamento cliente...</BGCard>
      </div>
    );
  }

  if (errorMessage || !customer) {
    return (
      <div className="customer-page bg-page-shell">
        <BGCard variant="danger">
          <BGSectionHeader title="Cliente non caricato" subtitle="Verifica permessi e disponibilità dei dati Supabase." />
          <pre className="error-details">{errorMessage}</pre>
          <small>ID: {customerId}</small>
        </BGCard>
      </div>
    );
  }

  const sectionNavItems: Array<{ key: SectionKey; label: string; eyebrow: string; icon: string }> = [
    { key: "overview", label: "Panoramica", eyebrow: "Sintesi", icon: "◆" },
    { key: "profile", label: "Profilo", eyebrow: "Anagrafica", icon: "👤" },
    { key: "subscriptions", label: "Abbonamenti", eyebrow: "Piani", icon: "🏋" },
    { key: "payments", label: "Pagamenti & Ricevute", eyebrow: "Cassa", icon: "€" },
    { key: "access", label: "Accessi", eyebrow: "Gate", icon: "⌁" },
    { key: "documents", label: "Documenti", eyebrow: "Medico", icon: "▣" },
    { key: "timeline", label: "Note & Timeline", eyebrow: "CRM", icon: "●" },
  ];

  const recentAccessLogs = accessLogs.slice(0, 3);
  const recentNotes = notes.slice(0, 3);
  const recentTimelineEvents = [
    ...subscriptions.slice(0, 2).map((item) => ({
      key: `sub-${item.id}`,
      title: item.subscription_plans?.name || "Abbonamento",
      subtitle: `${item.starts_at} → ${item.ends_at}`,
      date: item.created_at || item.starts_at,
    })),
    ...membershipFees.slice(0, 1).map((item) => ({
      key: `fee-${item.id}`,
      title: "Quota associativa",
      subtitle: `${item.valid_from} → ${item.valid_until}`,
      date: item.created_at || item.valid_from,
    })),
  ].slice(0, 3);
  const contractUrl = customer.contract_url || customer.contract_pdf_url || customer.agreement_url || "";
  const shortPlans = plans.slice(0, 6);

  function formatPlanDisplayName(planName: string) {
    const normalizedName = String(planName || "").trim();
    const daySets = [
      {
        match: "Lunedi-Mercoledi-Venerdi",
        compact: "Lun / Mer / Ven",
      },
      {
        match: "Martedi-Giovedi-Sabato",
        compact: "Mar / Gio / Sab",
      },
    ];

    const matchedDaySet = daySets.find((daySet) =>
      normalizedName.toLowerCase().includes(daySet.match.toLowerCase())
    );

    if (!matchedDaySet) {
      return { title: normalizedName || "Abbonamento", days: "" };
    }

    return {
      title:
        normalizedName
          .replace(new RegExp(matchedDaySet.match, "i"), "")
          .replace(/[\s-]+$/g, "")
          .trim() || "Abbonamento",
      days: matchedDaySet.compact,
    };
  }

  return (
    <div className="customer-page bg-page-shell">
      <style jsx>{`
        .customer-page {
          padding: 30px;
          color: #ffffff;
          background:
            radial-gradient(circle at 10% 0%, rgba(239, 68, 68, 0.12), transparent 28%),
            #050505;
          min-height: 100vh;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }
        .customer-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 22px;
          align-items: stretch;
          margin-bottom: 18px;
        }
        .hero-main {
          display: flex;
          gap: 18px;
          align-items: flex-start;
          min-width: 0;
        }
        .avatar, .avatar-placeholder {
          width: 86px;
          height: 86px;
          border-radius: 25px;
          flex: 0 0 auto;
          border: 2px solid rgba(255,255,255,.12);
          box-shadow: 0 18px 38px rgba(0,0,0,.36);
        }
        .avatar { object-fit: cover; }
        .avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #ef4444, #7f1d1d);
          color: #fff;
          font-size: 27px;
          font-weight: 950;
        }
        .hero-copy { min-width: 0; }
        .hero-copy h1 {
          margin: 0;
          font-size: clamp(30px, 4vw, 48px);
          line-height: .95;
          letter-spacing: -.06em;
          font-weight: 950;
        }
        .hero-meta, .muted, .small-muted {
          color: #9ca3af;
          font-size: 13px;
          line-height: 1.5;
        }
        .hero-meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .hero-statuses {
          display: grid;
          grid-template-columns: repeat(4, minmax(145px, 1fr));
          gap: 10px;
          margin-top: 16px;
        }
        .hero-actions {
          width: min(370px, 100%);
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          align-content: start;
        }
        .section-panel { display: grid; gap: 18px; }
        .overview-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .content-grid, .two-col-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          align-items: start;
        }
        .three-col-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        .status-box {
          display: grid;
          gap: 8px;
          min-height: 104px;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 20px;
          padding: 15px;
          background: rgba(255,255,255,.035);
        }
        .status-label {
          color: #8b8b8b;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .status-value {
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .mini-card {
          min-height: 154px;
          display: grid;
          align-content: space-between;
          gap: 14px;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 22px;
          padding: 18px;
          background: rgba(255,255,255,.035);
        }
        .mini-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .mini-title, .row-title, .plan-title {
          color: #fff;
          font-size: 15px;
          font-weight: 950;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }
        .row-copy { min-width: 0; }
        .mini-value {
          color: #f5f5f5;
          font-size: 14px;
          font-weight: 850;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .overview-list {
          display: grid;
          gap: 6px;
          margin-top: 10px;
          color: #a3a3a3;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
        }
        .overview-list span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .info-mini-card, .credential-mini {
          display: grid;
          gap: 7px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          padding: 13px 14px;
          background: rgba(255,255,255,.035);
          min-width: 0;
        }
        .info-label, .credential-section-title, .credential-mini-label {
          color: #8b8b8b;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .info-value, .credential-mini-value {
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }
        .actions, .actions-inline {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .actions-spread { justify-content: space-between; }
        .row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          padding: 14px;
          background: rgba(255,255,255,.035);
          min-width: 0;
        }
        .row-subtitle, .row-right {
          color: #a3a3a3;
          font-size: 13px;
          margin-top: 4px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .row-right {
          justify-self: end;
          text-align: right;
          white-space: normal;
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(180px, 1fr));
          gap: 14px;
        }
        .edit-field {
          display: grid;
          grid-template-rows: auto minmax(46px, auto);
          gap: 7px;
          min-width: 0;
        }
        .edit-field label {
          color: #a3a3a3;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          font-weight: 900;
        }
        .edit-field-full { grid-column: 1 / -1; }
        input, select, textarea {
          width: 100%;
          max-width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,.11);
          background: linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.025)), rgba(5,5,5,.92);
          color: #fff;
          outline: none;
          font-size: 14px;
          font-weight: 800;
          font-family: inherit;
        }
        input, select { min-height: 48px; padding: 0 14px; }
        textarea { min-height: 112px; padding: 14px; resize: vertical; line-height: 1.45; }
        input:focus, select:focus, textarea:focus {
          border-color: rgba(239,68,68,.62);
          box-shadow: 0 0 0 4px rgba(239,68,68,.16);
        }
        select option { background: #111; color: #fff; }
        .checkbox-field {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,.11);
          padding: 0 14px;
          background: rgba(255,255,255,.035);
        }
        .checkbox-field input { width: 18px; min-height: 18px; accent-color: #ef4444; }
        .payment-box, .manual-renew-box {
          padding: 15px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.035);
        }
        .quick-plan-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
          gap: 16px;
          align-items: stretch;
          min-width: 0;
        }
        .quick-plan-btn {
          width: 100%;
          min-width: 0;
          min-height: 218px;
          height: 100%;
          display: grid;
          grid-template-rows: minmax(0, 1fr) auto;
          align-items: stretch;
          justify-content: stretch;
          gap: 18px;
          text-align: left;
          border-radius: 24px;
          padding: 20px;
          border: 1px solid rgba(239,68,68,0.28);
          background: radial-gradient(circle at top left, rgba(239,68,68,.22), transparent 58%), linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.025)), rgba(8,8,8,.94);
          color: #fff;
          cursor: pointer;
          white-space: normal;
          line-height: 1.2;
          overflow: hidden;
          box-sizing: border-box;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 18px 42px rgba(0,0,0,.26);
        }
        .quick-plan-btn:hover {
          border-color: rgba(239,68,68,.48);
          background: radial-gradient(circle at top left, rgba(239,68,68,.3), transparent 58%), linear-gradient(145deg, rgba(255,255,255,.09), rgba(255,255,255,.03)), rgba(10,10,10,.96);
        }
        .plan-copy {
          display: grid;
          align-content: start;
          gap: 10px;
          min-width: 0;
          max-width: 100%;
        }
        .plan-title {
          display: block;
          font-size: clamp(16px, 2vw, 18px);
          line-height: 1.22;
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: normal;
          hyphens: auto;
        }
        .plan-days {
          display: inline-flex;
          width: fit-content;
          max-width: 100%;
          min-width: 0;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.07);
          color: #fca5a5;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .04em;
          text-transform: uppercase;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .plan-meta {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          min-width: 0;
          max-width: 100%;
        }
        .plan-price {
          display: block;
          color: #fff;
          font-size: clamp(28px, 4vw, 36px);
          line-height: .92;
          font-weight: 950;
          letter-spacing: -.055em;
          white-space: normal;
        }
        .history-list {
          display: grid;
          gap: 10px;
        }
        .history-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(118px, max-content);
          gap: 16px;
          align-items: start;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 20px;
          padding: 15px;
          background: linear-gradient(145deg, rgba(255,255,255,.055), rgba(255,255,255,.02)), rgba(7,7,7,.78);
          min-width: 0;
        }
        .history-main {
          display: grid;
          gap: 8px;
          min-width: 0;
        }
        .history-title {
          color: #fff;
          font-size: 14px;
          font-weight: 950;
          line-height: 1.3;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .history-period {
          color: #a3a3a3;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.45;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .history-side {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          flex-direction: column;
          justify-self: end;
          min-width: 0;
          max-width: 100%;
        }
        .history-amount {
          color: #fff;
          font-size: 16px;
          font-weight: 950;
          letter-spacing: -.02em;
          white-space: nowrap;
        }
        .history-method {
          color: #a3a3a3;
          font-size: 12px;
          font-weight: 850;
          line-height: 1.35;
          overflow-wrap: anywhere;
          text-align: right;
        }
        .credential-summary {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .credential-section {
          border-top: 1px solid rgba(255,255,255,.08);
          padding-top: 16px;
          margin-top: 16px;
          display: grid;
          gap: 12px;
        }
        .credential-pill-list { display: flex; flex-wrap: wrap; gap: 8px; }
        .credential-pill {
          border-radius: 999px;
          background: #050505;
          border: 1px solid #303030;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 800;
        }
        .qr-box {
          background: #fff;
          border-radius: 18px;
          padding: 14px;
          display: inline-flex;
          width: fit-content;
        }
        .qr-box img { width: 210px; height: 210px; display: block; }
        .mobile-pass-url, .error-details {
          border: 1px solid rgba(59, 130, 246, 0.22);
          background: rgba(59, 130, 246, 0.08);
          color: #bfdbfe;
          border-radius: 14px;
          padding: 12px;
          font-size: 12px;
          line-height: 1.45;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }
        .danger-text { color: #fb7185; }
        .success-text { color: #4ade80; }
        @media (max-width: 1180px) {
          .customer-hero, .content-grid, .two-col-grid, .overview-grid, .hero-statuses, .form-grid { grid-template-columns: 1fr; }
          .hero-actions { width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 720px) {
          .customer-page { padding: 18px; }
          .hero-main, .topbar { flex-direction: column; align-items: stretch; }
          .hero-actions, .info-grid, .credential-summary, .three-col-grid, .quick-plan-grid { grid-template-columns: 1fr; }
          .row, .history-row { grid-template-columns: 1fr; }
          .row-right, .history-side { justify-self: start; text-align: left; align-items: flex-start; min-width: 0; }
          .history-method { text-align: left; }
        }
      `}</style>

      <div className="topbar">
        <BGButton href="/customers" variant="ghost">← Torna ai clienti</BGButton>
      </div>

      <BGCard variant="premium" className="customer-hero">
        <div>
          <div className="hero-main">
            {customer?.photo_url ? (
              <img className="avatar" src={customer.photo_url} alt={customerName} />
            ) : (
              <div className="avatar-placeholder">{initials}</div>
            )}
            <div className="hero-copy">
              <div className="bg-eyebrow">Scheda cliente BodyGate</div>
              <h1>{customerName}</h1>
              <div className="hero-meta">
                <span>{customer.phone || "Telefono non presente"}</span>
                <span>•</span>
                <span>{customer.email || "Email non presente"}</span>
              </div>
              <div className="actions" style={{ marginTop: 12 }}>
                <BGStatusBadge tone={accessAllowed ? "success" : "danger"}>
                  {accessAllowed ? "Accesso attivo" : "Accesso bloccato"}
                </BGStatusBadge>
                <BGStatusBadge tone={customer?.is_active === false ? "danger" : "info"}>
                  {customer?.is_active === false ? "Cliente disattivo" : "Cliente attivo"}
                </BGStatusBadge>
                <BGStatusBadge tone={customer.badge_code || customer.controller_code ? "success" : "warning"}>
                  {customer.badge_code || customer.controller_code ? "Badge collegato" : "Badge mancante"}
                </BGStatusBadge>
              </div>
            </div>
          </div>
          <div className="hero-statuses">
            <StatusBox label="Abbonamento" value={activeSubscription ? `${activeSubscription.subscription_plans?.name || "Attivo"} · ${activeSubscription.ends_at}` : "Assente o scaduto"} ok={!!activeSubscription} />
            <StatusBox label="Certificato medico" value={certificateValid ? `Valido fino al ${medicalCertificateEnd}` : "Scaduto o mancante"} ok={!!certificateValid} />
            <StatusBox label="Quota associativa" value={activeMembership ? `Valida fino al ${activeMembership.valid_until}` : "Assente o scaduta"} ok={!!activeMembership} />
            <StatusBox label="Blocchi" value={activeBlock ? activeBlock.reason : "Nessun blocco"} ok={!activeBlock} />
          </div>
        </div>
        <div className="hero-actions">
          <BGButton onClick={() => setActiveSection("subscriptions")}>Rinnova</BGButton>
          <BGButton variant="secondary" onClick={() => setActiveSection("payments")}>Pagamenti</BGButton>
          <BGButton variant="secondary" onClick={() => setActiveSection("payments")}>Ricevute</BGButton>
          <BGButton variant="secondary" onClick={() => setActiveSection("access")}>Accessi</BGButton>
          <BGButton variant="ghost" onClick={() => { startEditCustomer(); setActiveSection("profile"); }}>Modifica</BGButton>
          <BGButton variant="danger" onClick={() => setActiveSection("access")}>Blocca</BGButton>
        </div>
      </BGCard>

      <BGPremiumSectionNav items={sectionNavItems} activeKey={activeSection} onChange={setActiveSection} ariaLabel="Sezioni scheda cliente" />

      {activeSection === "overview" ? (
        <section className="section-panel">
          <div className="overview-grid">
            <OverviewCard title="Abbonamento" ok={!!activeSubscription} value={activeSubscription ? `${activeSubscription.subscription_plans?.name || "Attivo"}` : "Da rinnovare"} note={activeSubscription ? `Scade ${activeSubscription.ends_at}` : "Nessun piano attivo"} action="Gestisci" onAction={() => setActiveSection("subscriptions")} />
            <OverviewCard title="Quota associativa" ok={!!activeMembership} value={activeMembership ? "Regolare" : "Da rinnovare"} note={activeMembership ? `Scade ${activeMembership.valid_until}` : "Quota mancante"} action="Gestisci" onAction={() => setActiveSection("subscriptions")} />
            <OverviewCard title="Certificato medico" ok={!!certificateValid} value={certificateValid ? "Valido" : "Critico"} note={certificateValid ? `Scade ${medicalCertificateEnd}` : "Upload o rinnovo richiesto"} action="Apri" onAction={() => setActiveSection("documents")} />
            <OverviewCard title="Pagamenti" ok value={`${subscriptions.length + membershipFees.length} movimenti`} note="Storici completi in sezione cassa" action="Apri" onAction={() => setActiveSection("payments")} />
            <OverviewCard title="Ricevute" ok value="Registro ricevute" note="A4 e ristampe mantenute" action="Apri" onAction={() => setActiveSection("payments")} />
            <OverviewCard title="Accessi" ok={accessAllowed} value={accessAllowed ? "Consentiti" : "Da verificare"} note="Ultimi 3 eventi" action="Apri" onAction={() => setActiveSection("access")}>
              <div className="overview-list">
                {recentAccessLogs.length === 0 ? <span>Nessun accesso recente</span> : recentAccessLogs.map((log) => (
                  <span key={log.id}>{log.was_allowed ? "Consentito" : "Negato"} · {new Date(log.access_time).toLocaleString()}</span>
                ))}
              </div>
            </OverviewCard>
            <OverviewCard title="Note" ok={recentNotes.length === 0} value={`${notes.length} note`} note={recentNotes[0]?.note || "Nessuna nota urgente"} action="Gestisci" onAction={() => setActiveSection("timeline")} />
            <OverviewCard title="Timeline recente" ok value={`${recentTimelineEvents.length} eventi`} note="Ultimi 3 eventi" action="Apri" onAction={() => setActiveSection("timeline")}>
              <div className="overview-list">
                {recentTimelineEvents.length === 0 ? <span>Nessun evento recente</span> : recentTimelineEvents.map((event) => (
                  <span key={event.key}>{event.title} · {event.date ? new Date(event.date).toLocaleDateString() : "-"}</span>
                ))}
              </div>
            </OverviewCard>
          </div>

        </section>
      ) : null}

      {activeSection === "profile" ? (
        <section className="content-grid">
          <BGCard variant="premium">
            <BGSectionHeader title="Profilo cliente" subtitle="Dati anagrafici completi e modifica professionale." actions={!isEditingCustomer ? <BGButton variant="secondary" onClick={startEditCustomer}>Modifica anagrafica</BGButton> : null} />
            <div className="info-grid">
              {customerInfo.map((item) => <InfoMini key={item.label} label={item.label} value={item.value} />)}
              <InfoMini label="Badge" value={customer.badge_code || "-"} />
              <InfoMini label="Controller" value={customer.controller_code || "-"} />
              <InfoMini label="Note reception" value={customer.reception_notes || "-"} />
            </div>
          </BGCard>

          <div className="section-panel">
            <CustomerPhotoUpload customerId={customer.id} currentPhotoUrl={customer.photo_url} onUploaded={(url) => setCustomer((prev: any) => ({ ...prev, photo_url: url }))} />
          </div>

          {isEditingCustomer ? (
            <BGCard variant="warning" className="edit-panel" >
              <BGSectionHeader title="Modifica anagrafica professionale" subtitle="Aggiorna dati cliente, credenziali principali e stato attività." actions={<div className="actions-inline"><BGButton variant="ghost" onClick={cancelEditCustomer} disabled={savingCustomer}>Annulla</BGButton><BGButton onClick={saveCustomerProfile} disabled={savingCustomer}>{savingCustomer ? "Salvataggio..." : "Salva"}</BGButton></div>} />
              <div className="form-grid">
                <EditField label="Nome"><input value={editForm.first_name || ""} onChange={(e) => updateEditField("first_name", e.target.value)} /></EditField>
                <EditField label="Cognome"><input value={editForm.last_name || ""} onChange={(e) => updateEditField("last_name", e.target.value)} /></EditField>
                <EditField label="Telefono"><input value={editForm.phone || ""} onChange={(e) => updateEditField("phone", e.target.value)} /></EditField>
                <EditField label="Email"><input type="email" value={editForm.email || ""} onChange={(e) => updateEditField("email", e.target.value)} /></EditField>
                <EditField label="Codice fiscale"><input value={editForm.fiscal_code || ""} onChange={(e) => updateEditField("fiscal_code", e.target.value.toUpperCase())} /></EditField>
                <EditField label="Data nascita"><input type="date" value={editForm.birth_date || ""} onChange={(e) => updateEditField("birth_date", e.target.value)} /></EditField>
                <EditField label="Sesso"><select value={editForm.gender || ""} onChange={(e) => updateEditField("gender", e.target.value)}><option value="">Non specificato</option><option value="M">Maschile</option><option value="F">Femminile</option><option value="ALTRO">Altro</option></select></EditField>
                <EditField label="Indirizzo"><input value={editForm.address || ""} onChange={(e) => updateEditField("address", e.target.value)} /></EditField>
                <EditField label="Città"><input value={editForm.city || ""} onChange={(e) => updateEditField("city", e.target.value)} /></EditField>
                <EditField label="CAP"><input value={editForm.postal_code || ""} onChange={(e) => updateEditField("postal_code", e.target.value)} /></EditField>
                <EditField label="Contatto emergenza"><input value={editForm.emergency_contact_name || ""} onChange={(e) => updateEditField("emergency_contact_name", e.target.value)} /></EditField>
                <EditField label="Telefono emergenza"><input value={editForm.emergency_contact_phone || ""} onChange={(e) => updateEditField("emergency_contact_phone", e.target.value)} /></EditField>
                <EditField label="Badge principale"><input value={editForm.badge_code || ""} onChange={(e) => updateEditField("badge_code", e.target.value)} /></EditField>
                <EditField label="Controller code"><input value={editForm.controller_code || ""} onChange={(e) => updateEditField("controller_code", e.target.value)} /></EditField>
                <EditField label="Stato cliente"><div className="checkbox-field"><input type="checkbox" checked={!!editForm.is_active} onChange={(e) => updateEditField("is_active", e.target.checked)} /><span>{editForm.is_active ? "Cliente attivo" : "Cliente disattivato"}</span></div></EditField>
                <EditField label="Note reception" full><textarea value={editForm.reception_notes || ""} onChange={(e) => updateEditField("reception_notes", e.target.value)} placeholder="Note interne rapide visibili alla reception..." /></EditField>
              </div>
            </BGCard>
          ) : null}
        </section>
      ) : null}

      {activeSection === "subscriptions" ? (
        <section className="section-panel">
          <div className="content-grid">
            <BGCard variant="premium">
              <BGSectionHeader title="Rinnovo rapido + pagamento" subtitle="Rinnovi con ricevuta automatica e metodo di pagamento selezionato." actions={<BGButton onClick={renewMembershipFee}>Rinnova quota 10€</BGButton>} />
              <div className="payment-box">
                <div className="small-muted" style={{ marginBottom: 8 }}>Metodo pagamento</div>
                <select value={selectedPaymentMethod} onChange={(e) => setSelectedPaymentMethod(e.target.value)}>
                  <option value="cash">Contanti</option>
                  <option value="pos">POS</option>
                  <option value="bank_transfer">Bonifico</option>
                </select>
              </div>
              <div className="quick-plan-grid">
                {shortPlans.length === 0 ? <BGEmptyState title="Nessun piano attivo" description="Configura i piani abbonamento per abilitare il rinnovo rapido." /> : null}
                {shortPlans.map((plan) => {
                  const price = Number(plan.promo_price || plan.price || 0);
                  const duration = Number(plan.duration_days || 0);
                  const planDisplayName = formatPlanDisplayName(plan.name);
                  return (
                    <BGButton key={plan.id} className="quick-plan-btn bg-plan-card" onClick={() => renewSubscription(plan.id)}>
                      <span className="plan-copy">
                        <span className="plan-title">{planDisplayName.title}</span>
                        {planDisplayName.days ? <span className="plan-days">{planDisplayName.days}</span> : null}
                      </span>
                      <span className="plan-meta">
                        <strong className="plan-price">€ {price.toFixed(2)}</strong>
                        <BGStatusBadge tone="info">{`${duration} giorni`}</BGStatusBadge>
                      </span>
                    </BGButton>
                  );
                })}
              </div>
              <div className="manual-renew-box">
                <div className="small-muted" style={{ marginBottom: 10 }}>Rinnovo manuale / piano personalizzato</div>
                <div className="actions">
                  <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
                    <option value="">Seleziona piano</option>
                    {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} - €{Number(plan.promo_price || plan.price || 0).toFixed(2)} - {plan.duration_days} giorni</option>)}
                  </select>
                  <BGButton variant="secondary" onClick={() => renewSubscription()}>Rinnova</BGButton>
                </div>
              </div>
            </BGCard>

            <HistoryCard title="Storico abbonamenti" subtitle="Tutti i rinnovi registrati per il cliente.">
              <div className="history-list">
                {subscriptions.length === 0 ? <BGEmptyState title="Nessun abbonamento" /> : subscriptions.map((sub) => <SubscriptionHistoryRow key={sub.id} subscription={sub} today={today} />)}
              </div>
            </HistoryCard>
          </div>
          <HistoryCard title="Storico quota associativa" subtitle="Quote annuali registrate.">
            <div className="history-list">
              {membershipFees.length === 0 ? <BGEmptyState title="Nessuna quota registrata" /> : membershipFees.map((fee) => <MembershipFeeHistoryRow key={fee.id} fee={fee} today={today} />)}
            </div>
          </HistoryCard>
        </section>
      ) : null}

      {activeSection === "payments" ? (
        <section className="section-panel">
          <CustomerPaymentsHistory customerId={customer.id} />
          <CustomerReceiptsHistory customerId={customer.id} />
        </section>
      ) : null}

      {activeSection === "access" ? (
        <section className="content-grid">
          <BGCard variant="premium">
            <BGSectionHeader title="Credenziali accesso" subtitle="RFID/NFC, QR DNake, Mobile Pass e WhatsApp." />
            <div className="credential-summary">
              <InfoMini label="RFID / NFC" value={`${cardCredentials.length} attive`} />
              <InfoMini label="QR DNake" value={activeDnakeQr ? "Attivo" : "Non generato"} tone={activeDnakeQr ? "success" : "danger"} />
            </div>
            <div className="credential-section">
              <div className="credential-section-title">Tessere / Card</div>
              {cardCredentials.length === 0 ? <BGEmptyState title="Nessuna tessera associata" /> : <div className="credential-pill-list">{cardCredentials.map((item) => <span className="credential-pill" key={item.id}>{String(item.type).toUpperCase()} · {item.controller_code || item.code}</span>)}</div>}
            </div>
            <div className="credential-section">
              <div className="credential-section-title">QR Code DNake</div>
              {activeDnakeQr ? (
                <>
                  {qrDataUrl ? <div className="qr-box"><img src={qrDataUrl} alt="QR DNake" /></div> : <BGEmptyState title="Generazione immagine QR" />}
                  <div className="info-grid"><InfoMini label="ID DNake" value={activeDnakeQr.dnake_user_id || "-"} /><InfoMini label="Nome DNake" value={activeDnakeQr.dnake_name || "-"} /><InfoMini label="Stato" value={activeDnakeQr.qr_status || "-"} /></div>
                  <div className="actions"><BGButton variant="secondary" onClick={printQr} disabled={!qrDataUrl}>Visualizza / stampa</BGButton><BGButton onClick={generateDnakeQr} disabled={qrGenerating}>{qrGenerating ? "Rigenero..." : "Rigenera QR"}</BGButton></div>
                </>
              ) : <><BGEmptyState title="Nessun QR DNake" description="Genera un QR DNake per abilitare il passaggio cliente." /><BGButton onClick={generateDnakeQr} disabled={qrGenerating}>{qrGenerating ? "Generazione..." : "Genera QR DNake"}</BGButton></>}
              {qrCredentials.length > 0 ? <div className="small-muted">Credenziali QR salvate: {qrCredentials.length}</div> : null}
            </div>
            <div className="credential-section">
              <div className="credential-section-title">Mobile Pass / WhatsApp</div>
              <BGEmptyState title="Mobile Pass cliente" description="Crea il link personale e invialo su WhatsApp senza cambiare la logica esistente." />
              {mobilePassUrl ? <div className="mobile-pass-url">{mobilePassUrl}</div> : null}
              <div className="actions"><BGButton variant="secondary" onClick={createOrGetMobilePass} disabled={mobilePassLoading}>{mobilePassLoading ? "Creo link..." : "Genera Pass Mobile"}</BGButton><BGButton onClick={sendMobilePassWhatsApp} disabled={mobilePassLoading}>Invia su WhatsApp</BGButton><BGButton variant="secondary" onClick={copyMobilePassLink} disabled={mobilePassLoading}>Copia link</BGButton></div>
              {!customer?.phone ? <div className="danger-text small-muted">Telefono cliente mancante: WhatsApp si aprirà senza destinatario.</div> : null}
            </div>
          </BGCard>

          <div className="section-panel">
            <BGCard variant={activeBlock ? "danger" : "soft"}>
              <BGSectionHeader title="Blocchi cliente" subtitle="Gestione blocchi operativi senza modificare access control." />
              <div className="actions"><input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Motivo blocco..." /><BGButton variant="danger" onClick={addBlock}>Blocca</BGButton></div>
              {blocks.length === 0 ? <BGEmptyState title="Nessun blocco presente" /> : blocks.map((block) => <div className="row" key={block.id}><div><div className="row-title">{block.reason}</div><div className="row-subtitle">Stato: {block.is_active ? "Attivo" : "Disattivato"}</div></div>{block.is_active ? <BGButton variant="secondary" onClick={() => disableBlock(block.id)}>Sblocca</BGButton> : null}</div>)}
            </BGCard>
            <HistoryCard title="Ultimi accessi" subtitle="Storico accessi leggibile e compatto.">
              {accessLogs.length === 0 ? <BGEmptyState title="Nessun accesso registrato" /> : accessLogs.map((log) => <InfoRow key={log.id} title={log.was_allowed ? "Accesso consentito" : "Accesso negato"} subtitle={new Date(log.access_time).toLocaleString()} right={log.reason || "-"} />)}
            </HistoryCard>
          </div>
        </section>
      ) : null}

      {activeSection === "documents" ? (
        <section className="content-grid">
          <MedicalCertificateCard customerId={customer.id} currentCertificateUrl={customer.medical_certificate_url} startDate={customer.medical_certificate_start_date} endDate={customer.medical_certificate_end_date} onUpdated={(data) => setCustomer((prev: any) => ({ ...prev, medical_certificate_url: data.url, medical_certificate_start_date: data.startDate, medical_certificate_end_date: data.endDate }))} />
          <BGCard variant="premium">
            <BGSectionHeader title="Documenti cliente" subtitle="Certificato medico, date e contratto se presente." />
            <div className="info-grid">
              <InfoMini label="Certificato" value={customer.medical_certificate_url ? "Caricato" : "Non caricato"} tone={customer.medical_certificate_url ? "success" : "danger"} />
              <InfoMini label="Inizio certificato" value={customer.medical_certificate_start_date || "-"} />
              <InfoMini label="Scadenza certificato" value={medicalCertificateEnd || "-"} tone={certificateValid ? "success" : "danger"} />
              <InfoMini label="Contratto" value={contractUrl ? "Disponibile" : "Non presente"} tone={contractUrl ? "success" : "neutral"} />
            </div>
            {contractUrl ? <BGButton href={contractUrl} variant="secondary">Apri contratto</BGButton> : <BGEmptyState title="Nessun contratto collegato" description="Se il record cliente contiene un link contratto verrà mostrato qui." />}
          </BGCard>
        </section>
      ) : null}

      {activeSection === "timeline" ? (
        <section className="section-panel">
          <BGCard variant="premium">
            <BGSectionHeader title="Note interne" subtitle="Aggiunta note e storico completo in card premium." />
            <div className="actions"><input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Scrivi una nota interna..." /><BGButton variant="secondary" onClick={addNote}>Aggiungi</BGButton></div>
            {notes.length === 0 ? <BGEmptyState title="Nessuna nota interna" /> : notes.map((note) => <div className="row" key={note.id}><div><div className="row-title">{note.note}</div><div className="row-subtitle">{new Date(note.created_at).toLocaleString()}</div></div></div>)}
          </BGCard>
          <CustomerTimeline customerId={customer.id} />
        </section>
      ) : null}
    </div>
  );
}
function StatusBox({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="status-box">
      <div className="status-label">{label}</div>
      <div className={`status-value ${ok ? "success-text" : "danger-text"}`}>{value}</div>
    </div>
  );
}

function OverviewCard({
  title,
  value,
  note,
  ok,
  action,
  onAction,
  children,
}: {
  title: string;
  value: string;
  note: string;
  ok: boolean;
  action: string;
  onAction: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="mini-card">
      <div className="mini-card-head">
        <div className="mini-title">{title}</div>
        <BGStatusBadge tone={ok ? "success" : "warning"}>{ok ? "OK" : "ATTENZIONE"}</BGStatusBadge>
      </div>
      <div>
        <div className="mini-value">{value}</div>
        <div className="small-muted">{note}</div>
        {children}
      </div>
      <BGButton variant="ghost" onClick={onAction}>{action}</BGButton>
    </div>
  );
}

function HistoryCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <BGCard variant="soft">
      <BGSectionHeader title={title} subtitle={subtitle} />
      {children}
    </BGCard>
  );
}

function InfoMini({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  return (
    <div className="info-mini-card">
      <div className="info-label">{label}</div>
      <div className={`info-value ${tone === "success" ? "success-text" : tone === "danger" ? "danger-text" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function EditField({
  label,
  children,
  full = false,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`edit-field ${full ? "edit-field-full" : ""}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function InfoRow({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: string;
}) {
  return (
    <div className="row">
      <div className="row-copy">
        <div className="row-title">{title}</div>
        <div className="row-subtitle">{subtitle}</div>
      </div>

      {right ? <div className="row-right">{right}</div> : null}
    </div>
  );
}

function SubscriptionHistoryRow({
  subscription,
  today,
}: {
  subscription: any;
  today: string;
}) {
  const amount = Number(subscription.amount || 0);
  const isActive = subscription.starts_at <= today && subscription.ends_at >= today;

  return (
    <div className="history-row">
      <div className="history-main">
        <div className="history-title">{subscription.subscription_plans?.name || "Abbonamento"}</div>
        <div className="history-period">Periodo: {subscription.starts_at || "—"} → {subscription.ends_at || "—"}</div>
      </div>
      <div className="history-side">
        <div className="history-amount">€ {amount.toFixed(2)}</div>
        <BGStatusBadge tone={isActive ? "success" : "neutral"}>{isActive ? "Attivo" : "Storico"}</BGStatusBadge>
      </div>
    </div>
  );
}

function MembershipFeeHistoryRow({
  fee,
  today,
}: {
  fee: any;
  today: string;
}) {
  const amount = Number(fee.amount || 0);
  const isValid = fee.valid_from <= today && fee.valid_until >= today;

  return (
    <div className="history-row">
      <div className="history-main">
        <div className="history-title">Quota associativa</div>
        <div className="history-period">Validità: {fee.valid_from || "—"} → {fee.valid_until || "—"}</div>
      </div>
      <div className="history-side">
        <div className="history-amount">€ {amount.toFixed(2)}</div>
        {fee.payment_method ? <div className="history-method">Metodo: {fee.payment_method}</div> : null}
        <BGStatusBadge tone={isValid ? "success" : "neutral"}>{isValid ? "Valida" : "Storico"}</BGStatusBadge>
      </div>
    </div>
  );
}
