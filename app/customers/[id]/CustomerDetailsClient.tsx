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

const OFFICIAL_SUBSCRIPTION_PLAN_NAMES = new Set([
  "Mensile",
  "Trimestrale",
  "Semestrale",
  "Annuale",
  "Annuale ridotto Lun Mer Ven",
  "Annuale ridotto Mar Gio Sab",
  "Mensile Ridotto Lunedi-Mercoledi-Venerdi",
  "Mensile Ridotto Martedi-Giovedi-Sabato",
  "Pilates",
]);

function isOfficialSubscriptionPlanName(name: unknown) {
  return OFFICIAL_SUBSCRIPTION_PLAN_NAMES.has(String(name || "").trim());
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function defaultMembershipEndDate() {
  const date = new Date();
  date.setDate(date.getDate() + 365);

  return formatLocalDate(date);
}

type StatusTone = "neutral" | "success" | "danger" | "warning" | "info";
type SectionKey =
  | "overview"
  | "profile"
  | "subscriptions"
  | "payments"
  | "access"
  | "documents"
  | "timeline";

export default function CustomerDetailsClient({
  customerId,
}: {
  customerId: string;
}) {
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
  const [membershipAmount, setMembershipAmount] = useState("10.00");
  const [membershipPaymentMethod, setMembershipPaymentMethod] = useState("cash");
  const [membershipValidFrom, setMembershipValidFrom] = useState(() =>
    formatLocalDate(new Date()),
  );
  const [membershipValidUntil, setMembershipValidUntil] = useState(() =>
    defaultMembershipEndDate(),
  );
  const [membershipSaving, setMembershipSaving] = useState(false);
  const [membershipFeedback, setMembershipFeedback] = useState("");
  const [membershipReceiptUrl, setMembershipReceiptUrl] = useState("");
  const [showSubscriptionHistory, setShowSubscriptionHistory] = useState(false);
  const [showMembershipHistory, setShowMembershipHistory] = useState(false);

  const [editingSubscriptionId, setEditingSubscriptionId] = useState("");
  const [subscriptionEditForm, setSubscriptionEditForm] = useState<any>({});
  const [savingSubscriptionEdit, setSavingSubscriptionEdit] = useState(false);

  const [renewalOpen, setRenewalOpen] = useState(false);
  const [renewalPlanId, setRenewalPlanId] = useState("");
  const [renewalStartDate, setRenewalStartDate] = useState("");
  const [renewalEndDate, setRenewalEndDate] = useState("");
  const [renewalAmount, setRenewalAmount] = useState("");
  const [renewalNotes, setRenewalNotes] = useState("");
  const [renewalSaving, setRenewalSaving] = useState(false);

  const [newNote, setNewNote] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [badgePanelOpen, setBadgePanelOpen] = useState(false);
  const [badgeDraft, setBadgeDraft] = useState("");
  const [badgeSaving, setBadgeSaving] = useState(false);
  const [badgeFeedback, setBadgeFeedback] = useState<{
    tone: "success" | "danger";
    message: string;
  } | null>(null);

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
    process.env.NEXT_PUBLIC_BODYGATE_PUBLIC_URL ||
    "https://bodygate-admin.vercel.app";

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

  function buildCustomerProfilePayload(source: any) {
    return {
      first_name: String(source.first_name || "").trim(),
      last_name: String(source.last_name || "").trim(),
      phone: String(source.phone || "").trim() || null,
      email: String(source.email || "").trim() || null,
      fiscal_code: String(source.fiscal_code || "").trim() || null,
      birth_date: source.birth_date || null,
      gender: source.gender || null,
      address: String(source.address || "").trim() || null,
      city: String(source.city || "").trim() || null,
      postal_code:
        String(source.postal_code || source.zip || "").trim() || null,
      emergency_contact_name:
        String(source.emergency_contact_name || "").trim() || null,
      emergency_contact_phone:
        String(source.emergency_contact_phone || "").trim() || null,
      reception_notes: String(source.reception_notes || "").trim() || null,
      badge_code: String(source.badge_code || "").trim() || null,
      controller_code: String(source.controller_code || "").trim() || null,
      is_active: source.is_active !== false,
    };
  }

  async function saveCustomerProfile() {
    if (!customer?.id) return;

    const payload = buildCustomerProfilePayload(editForm);

    if (!payload.first_name || !payload.last_name) {
      alert("Nome e cognome sono obbligatori.");
      return;
    }

    setSavingCustomer(true);

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
            (result?.error || result?.detail?.message || "Errore sconosciuto"),
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

  function openBadgePanel() {
    if (!customer) return;

    setBadgeDraft(
      String(customer.badge_code || customer.controller_code || ""),
    );
    setBadgeFeedback(null);
    setBadgePanelOpen(true);
  }

  function cancelBadgePanel() {
    setBadgeDraft("");
    setBadgeFeedback(null);
    setBadgePanelOpen(false);
  }

  async function saveBadgeCode() {
    if (!customer?.id) return;

    const normalizedBadge = badgeDraft.trim();

    if (!normalizedBadge) {
      setBadgeFeedback({
        tone: "danger",
        message: "Inserisci un codice badge valido",
      });
      return;
    }

    const payload = buildCustomerProfilePayload({
      ...customer,
      badge_code: normalizedBadge,
    });

    if (!payload.first_name || !payload.last_name) {
      setBadgeFeedback({
        tone: "danger",
        message: "Impossibile salvare: anagrafica cliente incompleta.",
      });
      return;
    }

    setBadgeSaving(true);
    setBadgeFeedback(null);

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
        console.error("saveBadgeCode API error", result);
        setBadgeFeedback({
          tone: "danger",
          message:
            result?.error ||
            result?.detail?.message ||
            "Errore sconosciuto durante il salvataggio badge.",
        });
        return;
      }

      setCustomer((prev: any) =>
        prev
          ? {
              ...prev,
              badge_code: result.customer?.badge_code || normalizedBadge,
              controller_code: result.customer?.controller_code || prev.controller_code,
            }
          : prev,
      );
      setEditForm((prev: any) => ({
        ...prev,
        badge_code: result.customer?.badge_code || normalizedBadge,
        controller_code: result.customer?.controller_code || prev.controller_code,
      }));
      setBadgePanelOpen(false);
      setBadgeFeedback({
        tone: "success",
        message: `Badge assegnato correttamente. Codice badge: ${result.customer?.badge_code || normalizedBadge}. Codice bridge: ${result.customer?.controller_code || "-"}.`,
      });
    } catch (error: any) {
      console.error("saveBadgeCode failed", error);
      setBadgeFeedback({
        tone: "danger",
        message:
          error?.message || "Errore imprevisto durante il salvataggio badge.",
      });
    } finally {
      setBadgeSaving(false);
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
          customerError?.code
            ? `Cliente non trovato o non leggibile. Codice diagnostico: ${customerError.code}. Apri la console tecnica per i dettagli.`
            : "Cliente non trovato o non leggibile. Verifica l’anagrafica dalla lista clienti.",
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
      setPlans(
        (plansData || []).filter((plan) =>
          isOfficialSubscriptionPlanName(plan.name),
        ),
      );

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
      (s) =>
        s.is_active !== false &&
        String(s.starts_at || "").slice(0, 10) <= today &&
        String(s.ends_at || "").slice(0, 10) >= today,
    );
  }, [subscriptions, today]);

  const plannedSubscription = useMemo(() => {
    return subscriptions.find(
      (s) =>
        s.is_active !== false && String(s.starts_at || "").slice(0, 10) > today,
    );
  }, [subscriptions, today]);

  const activeMembership = useMemo(() => {
    return membershipFees.find(
      (f) => f.valid_from <= today && f.valid_until >= today,
    );
  }, [membershipFees, today]);

  const activeBlock = useMemo(() => {
    return blocks.find(
      (b) => b.is_active && (!b.ends_at || new Date(b.ends_at) >= new Date()),
    );
  }, [blocks]);

  const medicalCertificateEnd =
    customer?.medical_certificate_end_date || customer?.medical_certificate_end;

  const certificateValid =
    medicalCertificateEnd && medicalCertificateEnd >= today;

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
    {
      label: "Tel. emergenza",
      value: customer?.emergency_contact_phone || "-",
    },
  ];

  const cardCredentials = useMemo(() => {
    return accessCredentials.filter(
      (item) => item.type === "card" || item.type === "nfc",
    );
  }, [accessCredentials]);

  const qrCredentials = useMemo(() => {
    return accessCredentials.filter((item) => item.type === "qr");
  }, [accessCredentials]);

  const activeDnakeQr = useMemo(() => {
    return (
      dnakeUsers.find((item) => item.qr_status === "active") ||
      dnakeUsers[0] ||
      null
    );
  }, [dnakeUsers]);

  function paymentMethodLabel(method: string) {
    if (method === "cash") return "Contanti";
    if (method === "pos") return "POS";
    if (method === "bank_transfer") return "Bonifico";
    return "Contanti";
  }

  function addDaysLocal(dateValue: string, days: number) {
    const base = new Date(`${dateValue}T00:00:00`);
    base.setDate(base.getDate() + days);

    const year = base.getFullYear();
    const month = String(base.getMonth() + 1).padStart(2, "0");
    const day = String(base.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatDateIT(dateValue?: string | null) {
    if (!dateValue) return "-";

    const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("it-IT");
  }

  function getSuggestedRenewalStartDate() {
    const active = subscriptions
      .filter((sub) => sub?.is_active !== false && sub?.ends_at)
      .sort((a, b) => String(b.ends_at).localeCompare(String(a.ends_at)))[0];

    if (active?.ends_at && String(active.ends_at).slice(0, 10) >= today) {
      return addDaysLocal(String(active.ends_at).slice(0, 10), 1);
    }

    return today;
  }

  function calculateRenewalEndDate(startDate: string, planId: string) {
    const plan = plans.find((item) => item.id === planId);
    const durationDays = Number(plan?.duration_days || 0);

    if (!startDate || !durationDays) return "";

    return addDaysLocal(startDate, durationDays);
  }

  function getRenewalPlan(planId = renewalPlanId) {
    return plans.find((item) => item.id === planId) || null;
  }

  function getRenewalWarnings() {
    const warnings: string[] = [];
    const selectedStart = renewalStartDate;
    const active = subscriptions
      .filter((sub) => sub?.is_active !== false && sub?.ends_at)
      .sort((a, b) => String(b.ends_at).localeCompare(String(a.ends_at)))[0];

    if (!selectedStart) return warnings;

    if (selectedStart < today) {
      warnings.push("La data di inizio scelta è precedente a oggi.");
    }

    if (selectedStart > today) {
      warnings.push(
        "Il rinnovo partirà in futuro. Il cliente potrà accedere da quella data.",
      );
    }

    if (
      active?.ends_at &&
      selectedStart <= String(active.ends_at).slice(0, 10)
    ) {
      warnings.push(
        `Il cliente ha già un abbonamento attivo fino al ${formatDateIT(active.ends_at)}. Il nuovo rinnovo si sovrappone.`,
      );
    }

    return warnings;
  }

  function openRenewalPanel(planIdOverride?: string) {
    const targetPlanId = planIdOverride || selectedPlanId;

    if (!targetPlanId) {
      alert("Seleziona un abbonamento.");
      return;
    }

    const plan = plans.find((item) => item.id === targetPlanId);

    if (!plan) {
      alert("Piano non trovato.");
      return;
    }

    const suggestedStartDate = getSuggestedRenewalStartDate();
    const amount = Number(plan.promo_price || plan.price || 0);

    setRenewalPlanId(targetPlanId);
    setSelectedPlanId(targetPlanId);
    setRenewalStartDate(suggestedStartDate);
    setRenewalEndDate(
      calculateRenewalEndDate(suggestedStartDate, targetPlanId),
    );
    setRenewalAmount(amount.toFixed(2));
    setRenewalNotes("");
    setRenewalOpen(true);
  }

  function updateRenewalStartDate(value: string) {
    setRenewalStartDate(value);
    setRenewalEndDate(calculateRenewalEndDate(value, renewalPlanId));
  }

  function updateRenewalPlan(planId: string) {
    const plan = plans.find((item) => item.id === planId);
    const amount = Number(plan?.promo_price || plan?.price || 0);

    setRenewalPlanId(planId);
    setSelectedPlanId(planId);
    setRenewalAmount(amount ? amount.toFixed(2) : "");
    setRenewalEndDate(
      calculateRenewalEndDate(renewalStartDate || today, planId),
    );
  }

  async function renewMembershipFee(allowDuplicate = false) {
    if (!customer?.id) {
      alert("Cliente non caricato.");
      return;
    }

    const amount = Number(String(membershipAmount).replace(",", "."));

    if (!amount || amount <= 0) {
      alert("Inserisci un importo quota associativa valido.");
      return;
    }

    if (!membershipPaymentMethod) {
      alert("Seleziona il metodo pagamento quota associativa.");
      return;
    }

    if (!membershipValidFrom) {
      alert("Seleziona la data inizio validità quota associativa.");
      return;
    }

    if (!membershipValidUntil) {
      alert("Seleziona la data fine validità quota associativa.");
      return;
    }

    if (membershipValidUntil < membershipValidFrom) {
      alert("La data fine quota deve essere successiva o uguale alla data inizio.");
      return;
    }

    setMembershipSaving(true);
    setMembershipFeedback("");
    setMembershipReceiptUrl("");

    try {
      const response = await fetch("/api/customers/renew-membership-fee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customer.id,
          amount,
          payment_method: membershipPaymentMethod,
          valid_from: membershipValidFrom,
          valid_until: membershipValidUntil,
          allow_duplicate: allowDuplicate,
        }),
      });

      const result = await response.json().catch(() => null);

      if (
        response.status === 409 &&
        result?.code &&
        String(result.code).startsWith("DUPLICATE_MEMBERSHIP")
      ) {
        const confirmed = window.confirm(
          `${result.error}\n\nVuoi registrare comunque una nuova quota e una nuova ricevuta?`,
        );

        if (confirmed) {
          await renewMembershipFee(true);
        }

        return;
      }

      if (!response.ok || !result?.ok) {
        alert(result?.error || "Errore rinnovo quota associativa.");
        return;
      }

      await loadAll();

      const receiptNumber = result.receipt?.receipt_number || "creata";
      const successMessage =
        `Quota associativa registrata.\n\n` +
        `Periodo: ${formatDateIT(membershipValidFrom)} - ${formatDateIT(membershipValidUntil)}\n` +
        `Ricevuta: ${receiptNumber}`;

      setMembershipFeedback(successMessage);
      setMembershipReceiptUrl(result.receipt_url || "");

      if (result.print_url) {
        const receiptWindow = window.open(result.print_url, "_blank");

        if (receiptWindow === null) {
          alert(
            "Quota registrata, ma il browser ha bloccato l'apertura della ricevuta. Aprila dallo storico ricevute.",
          );
        } else {
          alert(successMessage);
        }
      } else {
        alert(successMessage);
      }
    } catch (error) {
      console.error(error);
      alert("Errore imprevisto durante la registrazione quota associativa.");
    } finally {
      setMembershipSaving(false);
    }
  }

  async function renewSubscription() {
    if (!customer?.id) return alert("Cliente non caricato.");

    const plan = getRenewalPlan();

    if (!plan) {
      alert("Seleziona un abbonamento.");
      return;
    }

    if (!renewalStartDate) {
      alert("Seleziona la data di inizio abbonamento.");
      return;
    }

    const amount = Number(String(renewalAmount).replace(",", "."));

    if (!amount || amount <= 0) {
      alert("Inserisci un importo valido.");
      return;
    }

    setRenewalSaving(true);

    try {
      const res = await fetch("/api/customers/renew-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customer.id,
          plan_id: renewalPlanId,
          payment_method: selectedPaymentMethod,
          start_date: renewalStartDate,
          amount,
          notes: renewalNotes,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        console.error("renew-subscription error", json);
        alert(json?.error || "Errore rinnovo abbonamento.");
        return;
      }

      setRenewalOpen(false);

      const successMessage =
        `Rinnovo completato.\n\n` +
        `Cliente: ${json.customer_name || ""}\n` +
        `Piano: ${json.plan?.name || plan.name}\n` +
        `Periodo: ${formatDateIT(json.subscription?.starts_at)} - ${formatDateIT(json.subscription?.ends_at)}\n` +
        `Ricevuta: ${json.receipt?.receipt_number || "creata"}`;

      if (json.print_url) {
        const receiptWindow = window.open(json.print_url, "_blank");

        if (receiptWindow === null) {
          alert(
            "Rinnovo completato, ma il browser ha bloccato l'apertura della ricevuta. Aprila dallo storico ricevute.",
          );
        } else {
          alert(successMessage);
        }
      } else {
        alert(successMessage);
      }

      await loadAll();
    } catch (error) {
      console.error("renewSubscription failed", error);
      alert("Errore imprevisto durante il rinnovo abbonamento.");
    } finally {
      setRenewalSaving(false);
    }
  }

  function openEditSubscription(subscription: any) {
    setEditingSubscriptionId(subscription.id);
    setSubscriptionEditForm({
      plan_id: subscription.plan_id || "",
      starts_at: String(subscription.starts_at || "").slice(0, 10),
      ends_at: String(subscription.ends_at || "").slice(0, 10),
      amount: Number(subscription.amount || 0).toFixed(2),
      payment_method: subscription.payment_method || "cash",
      notes: "",
    });
    setShowSubscriptionHistory(true);
  }

  function cancelEditSubscription() {
    setEditingSubscriptionId("");
    setSubscriptionEditForm({});
  }

  function updateSubscriptionEditField(field: string, value: any) {
    setSubscriptionEditForm((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function saveSubscriptionEdit() {
    if (!customer?.id) return alert("Cliente non caricato.");

    if (!editingSubscriptionId) {
      alert("Nessun abbonamento selezionato.");
      return;
    }

    const amount = Number(
      String(subscriptionEditForm.amount || "").replace(",", "."),
    );

    if (!subscriptionEditForm.plan_id) {
      alert("Seleziona un piano.");
      return;
    }

    if (!subscriptionEditForm.starts_at) {
      alert("Inserisci la data inizio.");
      return;
    }

    if (!subscriptionEditForm.ends_at) {
      alert("Inserisci la data fine.");
      return;
    }

    if (subscriptionEditForm.ends_at < subscriptionEditForm.starts_at) {
      alert("La data fine non può essere precedente alla data inizio.");
      return;
    }

    if (!amount || amount <= 0) {
      alert("Inserisci un importo valido.");
      return;
    }

    setSavingSubscriptionEdit(true);

    try {
      const response = await fetch("/api/customers/update-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update",
          customer_id: customer.id,
          subscription_id: editingSubscriptionId,
          plan_id: subscriptionEditForm.plan_id,
          starts_at: subscriptionEditForm.starts_at,
          ends_at: subscriptionEditForm.ends_at,
          amount,
          payment_method: subscriptionEditForm.payment_method || "cash",
          notes: subscriptionEditForm.notes || "",
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        console.error("saveSubscriptionEdit error", result);
        alert(result?.error || "Errore modifica abbonamento.");
        return;
      }

      setEditingSubscriptionId("");
      setSubscriptionEditForm({});
      await loadAll();

      alert("Abbonamento modificato correttamente.");
    } catch (error) {
      console.error("saveSubscriptionEdit failed", error);
      alert("Errore imprevisto durante la modifica abbonamento.");
    } finally {
      setSavingSubscriptionEdit(false);
    }
  }

  async function cancelSubscriptionRecord(subscription: any) {
    if (!customer?.id) return alert("Cliente non caricato.");

    const confirmed = window.confirm(
      "Confermi l'annullamento di questo abbonamento?\n\nIl record resterà nello storico come ANNULLATO.",
    );

    if (!confirmed) return;

    const reason = window.prompt(
      "Motivo annullamento, opzionale:",
      "Errore inserimento reception",
    );

    try {
      const response = await fetch("/api/customers/update-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "cancel",
          customer_id: customer.id,
          subscription_id: subscription.id,
          reason: reason || "",
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        console.error("cancelSubscriptionRecord error", result);
        alert(result?.error || "Errore annullamento abbonamento.");
        return;
      }

      if (editingSubscriptionId === subscription.id) {
        setEditingSubscriptionId("");
        setSubscriptionEditForm({});
      }

      await loadAll();

      alert("Abbonamento annullato correttamente.");
    } catch (error) {
      console.error("cancelSubscriptionRecord failed", error);
      alert("Errore imprevisto durante l'annullamento abbonamento.");
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
        "Vuoi generare un nuovo utente/QR DNake per questo cliente?",
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
            (result?.error || result?.response || "Errore sconosciuto"),
        );
        return;
      }

      await loadAll();
      alert("QR DNake generato correttamente.");
    } catch (error: any) {
      alert(
        "Errore generazione QR DNake: " +
          (error?.message || "Errore sconosciuto"),
      );
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
      alert(
        error?.message ||
          "Errore imprevisto durante la creazione del Mobile Pass.",
      );
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
          <BGSectionHeader
            title="Cliente non caricato"
            subtitle="Verifica permessi e disponibilità dei dati Supabase."
          />
          <pre className="error-details">{errorMessage}</pre>
          <small>ID: {customerId}</small>
        </BGCard>
      </div>
    );
  }

  const sectionNavItems: Array<{
    key: SectionKey;
    label: string;
    eyebrow: string;
    icon: string;
  }> = [
    { key: "overview", label: "Panoramica", eyebrow: "Sintesi", icon: "◆" },
    { key: "profile", label: "Profilo", eyebrow: "Anagrafica", icon: "👤" },
    {
      key: "subscriptions",
      label: "Abbonamenti",
      eyebrow: "Piani",
      icon: "🏋",
    },
    {
      key: "payments",
      label: "Pagamenti & Ricevute",
      eyebrow: "Cassa",
      icon: "€",
    },
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
  const contractUrl =
    customer.contract_url ||
    customer.contract_pdf_url ||
    customer.agreement_url ||
    "";
  const shortPlans = plans.slice(0, 6);

  const activeSubscriptionStart = String(
    activeSubscription?.starts_at || "",
  ).slice(0, 10);
  const activeSubscriptionEnd = String(activeSubscription?.ends_at || "").slice(
    0,
    10,
  );
  const plannedSubscriptionStart = String(
    plannedSubscription?.starts_at || "",
  ).slice(0, 10);
  const currentPlanName =
    activeSubscription?.subscription_plans?.name ||
    plannedSubscription?.subscription_plans?.name ||
    "Nessun piano attivo";
  const lastRenewal = subscriptions[0] || null;
  const lastRenewalAmount =
    lastRenewal?.amount != null
      ? `€ ${Number(lastRenewal.amount || 0).toFixed(2)}`
      : "-";
  const lastAccess = accessLogs[0] || null;

  const daysRemaining = activeSubscriptionEnd
    ? Math.ceil(
        (new Date(`${activeSubscriptionEnd}T00:00:00`).getTime() -
          new Date(`${today}T00:00:00`).getTime()) /
          86400000,
      )
    : null;

  const subscriptionStatus = activeSubscription
    ? daysRemaining !== null && daysRemaining <= 7
      ? "In scadenza"
      : "Attivo"
    : plannedSubscription
      ? "Pianificato"
      : subscriptions.length > 0
        ? "Scaduto"
        : "Nessuno";

  const subscriptionTone: StatusTone = activeSubscription
    ? daysRemaining !== null && daysRemaining <= 7
      ? "warning"
      : "success"
    : plannedSubscription
      ? "info"
      : "danger";

  const certificateStatusLabel = certificateValid
    ? `Valido fino al ${formatDateIT(medicalCertificateEnd)}`
    : medicalCertificateEnd
      ? `Scaduto il ${formatDateIT(medicalCertificateEnd)}`
      : "Mancante";

  const membershipStatusLabel = activeMembership
    ? `Valida fino al ${formatDateIT(activeMembership.valid_until)}`
    : membershipFees.length > 0
      ? "Non valida oggi"
      : "Non registrata";

  const badgeDisplay =
    customer.badge_code || customer.controller_code || "Non assegnato";
  const mobilePassStatus = mobilePassUrl ? "Link creato" : "Pronto da generare";

  const accessDecisionChecks = [
    { label: "Cliente attivo", ok: customer?.is_active !== false },
    { label: "Abbonamento", ok: !!activeSubscription },
    { label: "Quota", ok: !!activeMembership },
    { label: "Certificato", ok: !!certificateValid },
    { label: "Blocchi", ok: !activeBlock },
  ];

  const customerAlerts = [
    !activeSubscription ? "Abbonamento non attivo" : null,
    activeSubscription && daysRemaining !== null && daysRemaining <= 7
      ? `Abbonamento in scadenza tra ${Math.max(daysRemaining, 0)} giorni`
      : null,
    !certificateValid ? "Certificato medico scaduto o mancante" : null,
    !activeMembership ? "Quota associativa da verificare" : null,
    activeBlock ? `Blocco attivo: ${activeBlock.reason}` : null,
    customer?.is_active === false ? "Cliente disattivato" : null,
  ].filter(Boolean) as string[];

  const compactProfileInfo = [
    { label: "Telefono", value: customer?.phone || "-" },
    { label: "Email", value: customer?.email || "-" },
    { label: "Codice fiscale", value: customer?.fiscal_code || "-" },
    { label: "Data nascita", value: customer?.birth_date || "-" },
    {
      label: "Indirizzo",
      value:
        [
          customer?.address,
          customer?.city,
          customer?.postal_code || customer?.zip,
        ]
          .filter(Boolean)
          .join(", ") || "-",
    },
    { label: "Note", value: customer?.reception_notes || "-" },
  ];

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
      normalizedName.toLowerCase().includes(daySet.match.toLowerCase()),
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
            radial-gradient(
              circle at 10% 0%,
              rgba(239, 68, 68, 0.12),
              transparent 28%
            ),
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
        .avatar,
        .avatar-placeholder {
          width: 86px;
          height: 86px;
          border-radius: 25px;
          flex: 0 0 auto;
          border: 2px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.36);
        }
        .avatar {
          object-fit: cover;
        }
        .avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #ef4444, #7f1d1d);
          color: #fff;
          font-size: 27px;
          font-weight: 950;
        }
        .hero-copy {
          min-width: 0;
        }
        .hero-copy h1 {
          margin: 0;
          font-size: clamp(30px, 4vw, 48px);
          line-height: 0.95;
          letter-spacing: -0.06em;
          font-weight: 950;
        }
        .hero-meta,
        .muted,
        .small-muted {
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
        .section-panel {
          display: grid;
          gap: 18px;
        }
        .operations-center {
          display: grid;
          gap: 16px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 30px;
          padding: 18px;
          background:
            radial-gradient(
              circle at 4% 0%,
              rgba(239, 68, 68, 0.16),
              transparent 28%
            ),
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.055),
              rgba(255, 255, 255, 0.018)
            ),
            rgba(6, 6, 8, 0.9);
          box-shadow:
            0 22px 58px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.055);
        }
        .operations-center-grid,
        .overview-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          align-items: stretch;
        }
        .operations-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
          gap: 18px;
          align-items: stretch;
        }
        .situation-card {
          border: 1px solid rgba(239, 68, 68, 0.22);
          border-radius: 28px;
          padding: 22px;
          background:
            linear-gradient(
              135deg,
              rgba(239, 68, 68, 0.13),
              rgba(255, 255, 255, 0.035) 34%,
              rgba(5, 5, 5, 0.88)
            ),
            rgba(10, 10, 10, 0.9);
          box-shadow: 0 22px 54px rgba(0, 0, 0, 0.35);
          display: grid;
          gap: 18px;
        }
        .situation-top {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .situation-title {
          margin: 0;
          color: #fff;
          font-size: clamp(24px, 3vw, 38px);
          line-height: 0.95;
          letter-spacing: -0.055em;
          font-weight: 950;
        }
        .situation-subtitle {
          color: #a3a3a3;
          font-size: 13px;
          font-weight: 800;
          margin-top: 8px;
        }
        .access-decision-strip {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 22px;
          padding: 14px;
          background: rgba(0, 0, 0, 0.3);
          display: grid;
          grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.2fr);
          gap: 14px;
          align-items: center;
        }
        .access-decision-strip.allowed {
          border-color: rgba(74, 222, 128, 0.25);
          background: linear-gradient(
            135deg,
            rgba(22, 101, 52, 0.28),
            rgba(0, 0, 0, 0.28)
          );
        }
        .access-decision-strip.denied {
          border-color: rgba(251, 113, 133, 0.28);
          background: linear-gradient(
            135deg,
            rgba(127, 29, 29, 0.34),
            rgba(0, 0, 0, 0.28)
          );
        }
        .access-decision-label {
          color: rgba(255, 255, 255, 0.62);
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .access-decision-value {
          color: #fff;
          font-size: clamp(22px, 3vw, 34px);
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.05em;
          margin-top: 5px;
        }
        .access-check-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }
        .access-check-pill {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          padding: 8px 10px;
          color: rgba(255, 255, 255, 0.76);
          font-size: 11px;
          font-weight: 900;
          background: rgba(255, 255, 255, 0.04);
        }
        .access-check-pill.ok {
          border-color: rgba(74, 222, 128, 0.22);
          color: #bbf7d0;
          background: rgba(22, 101, 52, 0.18);
        }
        .access-check-pill.ko {
          border-color: rgba(251, 113, 133, 0.24);
          color: #fecdd3;
          background: rgba(127, 29, 29, 0.2);
        }
        .situation-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .situation-kpi {
          min-width: 0;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 18px;
          padding: 14px;
          background: rgba(0, 0, 0, 0.32);
        }
        .situation-kpi strong {
          display: block;
          color: #fff;
          font-size: 17px;
          line-height: 1.15;
          font-weight: 950;
          overflow-wrap: anywhere;
        }
        .situation-kpi span {
          display: block;
          color: #8b8b8b;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .alert-stack {
          display: grid;
          gap: 8px;
        }
        .alert-chip {
          border: 1px solid rgba(251, 113, 133, 0.25);
          background: rgba(127, 29, 29, 0.28);
          color: #fecdd3;
          border-radius: 16px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 850;
          line-height: 1.35;
        }
        .compact-side-stack {
          display: grid;
          gap: 18px;
        }
        .compact-info-list {
          display: grid;
          gap: 9px;
        }
        .compact-info-row {
          display: grid;
          grid-template-columns: 112px minmax(0, 1fr);
          gap: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          padding-bottom: 9px;
        }
        .compact-info-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }
        .compact-info-row span {
          color: #8b8b8b;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .compact-info-row strong {
          color: #fff;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 850;
          overflow-wrap: anywhere;
        }
        .content-grid,
        .two-col-grid {
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
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 20px;
          padding: 15px;
          background: rgba(255, 255, 255, 0.035);
        }
        .status-label {
          color: #8b8b8b;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .status-value {
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .mini-card {
          position: relative;
          isolation: isolate;
          min-height: 218px;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.105);
          border-radius: 24px;
          padding: 18px;
          background:
            radial-gradient(
              circle at 92% 0%,
              rgba(239, 68, 68, 0.14),
              transparent 38%
            ),
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.075),
              rgba(255, 255, 255, 0.022)
            ),
            rgba(8, 8, 10, 0.94);
          box-shadow:
            0 18px 42px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
        }
        .mini-card::before {
          content: "";
          position: absolute;
          inset: 1px;
          z-index: -1;
          border-radius: inherit;
          background:
            linear-gradient(90deg, rgba(239, 68, 68, 0.12), transparent 46%),
            radial-gradient(
              circle at top left,
              rgba(255, 255, 255, 0.08),
              transparent 32%
            );
          opacity: 0.76;
          transition: opacity 0.18s ease;
        }
        .mini-card::after {
          content: "";
          position: absolute;
          top: 18px;
          bottom: 18px;
          left: 0;
          width: 3px;
          border-radius: 999px;
          background: linear-gradient(180deg, #ef4444, rgba(153, 27, 27, 0.22));
          box-shadow: 0 0 18px rgba(239, 68, 68, 0.24);
        }
        .mini-card:hover {
          transform: translateY(-2px);
          border-color: rgba(239, 68, 68, 0.38);
          box-shadow:
            0 24px 58px rgba(0, 0, 0, 0.4),
            0 0 34px rgba(239, 68, 68, 0.08);
        }
        .mini-card:hover::before {
          opacity: 1;
        }
        .mini-card-success::after {
          background: linear-gradient(180deg, #22c55e, rgba(21, 128, 61, 0.22));
          box-shadow: 0 0 18px rgba(34, 197, 94, 0.2);
        }
        .mini-card-warning::after {
          background: linear-gradient(180deg, #f59e0b, rgba(180, 83, 9, 0.22));
          box-shadow: 0 0 18px rgba(245, 158, 11, 0.2);
        }
        .mini-card-danger::after {
          background: linear-gradient(180deg, #fb7185, rgba(190, 18, 60, 0.24));
        }
        .mini-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          min-width: 0;
        }
        .mini-card-title-stack {
          display: grid;
          gap: 6px;
          min-width: 0;
        }
        .mini-card-eyebrow {
          color: #fca5a5;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.1em;
          line-height: 1;
          text-transform: uppercase;
        }
        .mini-title,
        .row-title,
        .plan-title {
          color: #fff;
          font-size: 15px;
          font-weight: 950;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }
        .row-copy {
          min-width: 0;
        }
        .mini-card-copy {
          display: grid;
          align-content: start;
          gap: 8px;
          min-width: 0;
        }
        .mini-value {
          color: #fff;
          font-size: 18px;
          font-weight: 950;
          line-height: 1.22;
          letter-spacing: -0.025em;
          overflow-wrap: anywhere;
        }
        .mini-card-action {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding-top: 2px;
        }
        .mini-card-action .bg-button {
          width: 100%;
          min-height: 40px;
          justify-content: center;
          padding-inline: 14px;
        }
        .overview-list {
          display: grid;
          gap: 6px;
          margin-top: 4px;
          color: #a3a3a3;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
        }
        .overview-list span {
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .operation-detail-pill {
          display: inline-flex;
          width: fit-content;
          max-width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          padding: 6px 9px;
          background: rgba(255, 255, 255, 0.045);
          color: rgba(255, 255, 255, 0.78);
          font-size: 11px;
          font-weight: 900;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .info-mini-card,
        .credential-mini {
          display: grid;
          gap: 7px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 13px 14px;
          background: rgba(255, 255, 255, 0.035);
          min-width: 0;
        }
        .info-label,
        .credential-section-title,
        .credential-mini-label {
          color: #8b8b8b;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .info-value,
        .credential-mini-value {
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }
        .actions,
        .actions-inline {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .actions-spread {
          justify-content: space-between;
        }
        .row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.035);
          min-width: 0;
        }
        .row-subtitle,
        .row-right {
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
        .edit-field-full {
          grid-column: 1 / -1;
        }
        input,
        select,
        textarea {
          width: 100%;
          max-width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.07),
              rgba(255, 255, 255, 0.025)
            ),
            rgba(5, 5, 5, 0.92);
          color: #fff;
          outline: none;
          font-size: 14px;
          font-weight: 800;
          font-family: inherit;
        }
        input,
        select {
          min-height: 48px;
          padding: 0 14px;
        }
        textarea {
          min-height: 112px;
          padding: 14px;
          resize: vertical;
          line-height: 1.45;
        }
        input:focus,
        select:focus,
        textarea:focus {
          border-color: rgba(239, 68, 68, 0.62);
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.16);
        }
        select option {
          background: #111;
          color: #fff;
        }
        .checkbox-field {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          padding: 0 14px;
          background: rgba(255, 255, 255, 0.035);
        }
        .checkbox-field input {
          width: 18px;
          min-height: 18px;
          accent-color: #ef4444;
        }
        .payment-box,
        .manual-renew-box {
          padding: 15px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.035);
        }
        .quick-plan-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(min(100%, 280px), 1fr)
          );
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
          border: 1px solid rgba(239, 68, 68, 0.28);
          background:
            radial-gradient(
              circle at top left,
              rgba(239, 68, 68, 0.22),
              transparent 58%
            ),
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.07),
              rgba(255, 255, 255, 0.025)
            ),
            rgba(8, 8, 8, 0.94);
          color: #fff;
          cursor: pointer;
          white-space: normal;
          line-height: 1.2;
          overflow: hidden;
          box-sizing: border-box;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 18px 42px rgba(0, 0, 0, 0.26);
        }
        .quick-plan-btn:hover {
          border-color: rgba(239, 68, 68, 0.48);
          background:
            radial-gradient(
              circle at top left,
              rgba(239, 68, 68, 0.3),
              transparent 58%
            ),
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.09),
              rgba(255, 255, 255, 0.03)
            ),
            rgba(10, 10, 10, 0.96);
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
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.07);
          color: #fca5a5;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.04em;
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
          line-height: 0.92;
          font-weight: 950;
          letter-spacing: -0.055em;
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
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 20px;
          padding: 15px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.055),
              rgba(255, 255, 255, 0.02)
            ),
            rgba(7, 7, 7, 0.78);
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
          letter-spacing: -0.02em;
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
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 16px;
          margin-top: 16px;
          display: grid;
          gap: 12px;
        }
        .credential-pill-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .credential-pill {
          border-radius: 999px;
          background: #050505;
          border: 1px solid #303030;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 800;
        }

        .badge-card-panel,
        .badge-edit-panel {
          display: grid;
          gap: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 16px;
          background:
            radial-gradient(
              circle at top left,
              rgba(239, 68, 68, 0.16),
              transparent 34%
            ),
            rgba(255, 255, 255, 0.035);
        }
        .badge-card-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .badge-card-code {
          color: #fff;
          font-size: 22px;
          font-weight: 950;
          letter-spacing: -0.03em;
          overflow-wrap: anywhere;
        }
        .badge-edit-panel {
          background:
            linear-gradient(145deg, rgba(239, 68, 68, 0.12), transparent),
            rgba(5, 5, 5, 0.82);
        }
        .badge-feedback {
          border-radius: 14px;
          padding: 11px 12px;
          font-size: 13px;
          font-weight: 800;
        }
        .badge-feedback-success {
          border: 1px solid rgba(34, 197, 94, 0.24);
          background: rgba(34, 197, 94, 0.1);
          color: #bbf7d0;
        }
        .badge-feedback-danger {
          border: 1px solid rgba(239, 68, 68, 0.28);
          background: rgba(239, 68, 68, 0.1);
          color: #fecaca;
        }
        .qr-box {
          background: #fff;
          border-radius: 18px;
          padding: 14px;
          display: inline-flex;
          width: fit-content;
        }
        .qr-box img {
          width: 210px;
          height: 210px;
          display: block;
        }
        .mobile-pass-url,
        .error-details {
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
        .danger-text {
          color: #fb7185;
        }
        .success-text {
          color: #4ade80;
        }
        @media (max-width: 1180px) {
          .customer-hero,
          .content-grid,
          .two-col-grid,
          .operations-grid,
          .hero-statuses,
          .form-grid,
          .situation-kpis {
            grid-template-columns: 1fr;
          }
          .operations-center-grid,
          .overview-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .hero-actions {
            width: 100%;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .customer-page {
            padding: 18px;
          }
          .access-decision-strip {
            grid-template-columns: 1fr;
          }
          .access-check-grid {
            justify-content: flex-start;
          }
          .hero-main,
          .topbar {
            flex-direction: column;
            align-items: stretch;
          }
          .hero-actions,
          .operations-center-grid,
          .overview-grid,
          .info-grid,
          .credential-summary,
          .three-col-grid,
          .quick-plan-grid {
            grid-template-columns: 1fr;
          }
          .operations-center {
            padding: 14px;
            border-radius: 24px;
          }
          .compact-info-row {
            grid-template-columns: 1fr;
            gap: 4px;
          }
          .row,
          .history-row {
            grid-template-columns: 1fr;
          }
          .row-right,
          .history-side {
            justify-self: start;
            text-align: left;
            align-items: flex-start;
            min-width: 0;
          }
          .history-method {
            text-align: left;
          }
        }
      `}</style>
      <style jsx global>{`
        .operations-center-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          align-items: stretch;
        }
        .mini-card {
          position: relative;
          isolation: isolate;
          min-height: 218px;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.105);
          border-radius: 24px;
          padding: 18px;
          background:
            radial-gradient(
              circle at 92% 0%,
              rgba(239, 68, 68, 0.14),
              transparent 38%
            ),
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.075),
              rgba(255, 255, 255, 0.022)
            ),
            rgba(8, 8, 10, 0.94);
          box-shadow:
            0 18px 42px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
        }
        .mini-card::before {
          content: "";
          position: absolute;
          inset: 1px;
          z-index: -1;
          border-radius: inherit;
          background:
            linear-gradient(90deg, rgba(239, 68, 68, 0.12), transparent 46%),
            radial-gradient(
              circle at top left,
              rgba(255, 255, 255, 0.08),
              transparent 32%
            );
          opacity: 0.76;
          transition: opacity 0.18s ease;
        }
        .mini-card::after {
          content: "";
          position: absolute;
          top: 18px;
          bottom: 18px;
          left: 0;
          width: 3px;
          border-radius: 999px;
          background: linear-gradient(180deg, #ef4444, rgba(153, 27, 27, 0.22));
          box-shadow: 0 0 18px rgba(239, 68, 68, 0.24);
        }
        .mini-card:hover {
          transform: translateY(-2px);
          border-color: rgba(239, 68, 68, 0.38);
          box-shadow:
            0 24px 58px rgba(0, 0, 0, 0.4),
            0 0 34px rgba(239, 68, 68, 0.08);
        }
        .mini-card:hover::before {
          opacity: 1;
        }
        .mini-card-success::after {
          background: linear-gradient(180deg, #22c55e, rgba(21, 128, 61, 0.22));
          box-shadow: 0 0 18px rgba(34, 197, 94, 0.2);
        }
        .mini-card-warning::after {
          background: linear-gradient(180deg, #f59e0b, rgba(180, 83, 9, 0.22));
          box-shadow: 0 0 18px rgba(245, 158, 11, 0.2);
        }
        .mini-card-danger::after {
          background: linear-gradient(180deg, #fb7185, rgba(190, 18, 60, 0.24));
          box-shadow: 0 0 18px rgba(251, 113, 133, 0.2);
        }
        .mini-card-info::after {
          background: linear-gradient(180deg, #60a5fa, rgba(37, 99, 235, 0.24));
          box-shadow: 0 0 18px rgba(96, 165, 250, 0.2);
        }
        .mini-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          min-width: 0;
        }
        .mini-card-title-stack {
          display: grid;
          gap: 6px;
          min-width: 0;
        }
        .mini-card-eyebrow {
          color: #fca5a5;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.1em;
          line-height: 1;
          text-transform: uppercase;
        }
        .mini-title {
          color: #fff;
          font-size: 15px;
          font-weight: 950;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }
        .mini-card-copy {
          display: grid;
          align-content: start;
          gap: 8px;
          min-width: 0;
        }
        .mini-value {
          color: #fff;
          font-size: 18px;
          font-weight: 950;
          line-height: 1.22;
          letter-spacing: -0.025em;
          overflow-wrap: anywhere;
        }
        .mini-card-action {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding-top: 2px;
        }
        .mini-card-action .bg-button {
          width: 100%;
          min-height: 40px;
          justify-content: center;
          padding-inline: 14px;
        }
        .overview-list {
          display: grid;
          gap: 6px;
          margin-top: 4px;
          color: #a3a3a3;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
        }
        .overview-list span {
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .operation-detail-pill {
          display: inline-flex;
          width: fit-content;
          max-width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          padding: 6px 9px;
          background: rgba(255, 255, 255, 0.045);
          color: rgba(255, 255, 255, 0.78);
          font-size: 11px;
          font-weight: 900;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }
        @media (max-width: 1180px) {
          .operations-center-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .operations-center-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="topbar">
        <BGButton href="/customers" variant="ghost">
          ← Torna ai clienti
        </BGButton>
      </div>

      <BGCard variant="premium" className="customer-hero">
        <div>
          <div className="hero-main">
            {customer?.photo_url ? (
              <img
                className="avatar"
                src={customer.photo_url}
                alt={customerName}
              />
            ) : (
              <div className="avatar-placeholder">{initials}</div>
            )}
            <div className="hero-copy">
              <div className="bg-eyebrow">Scheda cliente BodyGate</div>
              <h1>{customerName}</h1>
              <div className="hero-meta">
                <span>{`Badge ${badgeDisplay}`}</span>
                <span>•</span>
                <span>{customer.phone || "Telefono non presente"}</span>
                <span>•</span>
                <span>{customer.email || "Email non presente"}</span>
              </div>
              <div className="actions" style={{ marginTop: 12 }}>
                <BGStatusBadge tone={accessAllowed ? "success" : "danger"}>
                  {accessAllowed ? "Può entrare" : "Non può entrare"}
                </BGStatusBadge>
                <BGStatusBadge tone={subscriptionTone}>
                  {subscriptionStatus}
                </BGStatusBadge>
                <BGStatusBadge
                  tone={customer?.is_active === false ? "danger" : "info"}
                >
                  {customer?.is_active === false
                    ? "Cliente disattivo"
                    : "Cliente attivo"}
                </BGStatusBadge>
                <BGStatusBadge
                  tone={
                    customer.badge_code || customer.controller_code
                      ? "success"
                      : "warning"
                  }
                >
                  {customer.badge_code || customer.controller_code
                    ? "Badge collegato"
                    : "Badge mancante"}
                </BGStatusBadge>
              </div>
            </div>
          </div>
          <div className="hero-statuses">
            <StatusBox
              label="Abbonamento"
              value={
                activeSubscription
                  ? `${activeSubscription.subscription_plans?.name || "Attivo"} · ${formatDateIT(activeSubscription.ends_at)}`
                  : "Assente o scaduto"
              }
              ok={!!activeSubscription}
            />
            <StatusBox
              label="Certificato medico"
              value={certificateStatusLabel}
              ok={!!certificateValid}
            />
            <StatusBox
              label="Quota associativa"
              value={membershipStatusLabel}
              ok={!!activeMembership}
            />
            <StatusBox
              label="Blocchi"
              value={activeBlock ? activeBlock.reason : "Nessun blocco"}
              ok={!activeBlock}
            />
          </div>
        </div>
        <div className="hero-actions">
          <BGButton onClick={() => setActiveSection("subscriptions")}>
            Rinnova
          </BGButton>
          <BGButton
            variant="secondary"
            onClick={() => setActiveSection("payments")}
          >
            Registra pagamento
          </BGButton>
          <BGButton
            variant="secondary"
            onClick={() => {
              startEditCustomer();
              setActiveSection("profile");
            }}
          >
            Modifica cliente
          </BGButton>
          <BGButton
            variant="secondary"
            onClick={() => {
              void sendMobilePassWhatsApp();
            }}
            disabled={mobilePassLoading}
          >
            Mobile Pass / WhatsApp
          </BGButton>
          {customer?.phone ? (
            <BGButton href={`tel:${customer.phone}`} variant="ghost">
              Chiama
            </BGButton>
          ) : (
            <BGButton
              variant="ghost"
              onClick={() => setActiveSection("profile")}
            >
              Telefono
            </BGButton>
          )}
          <BGButton href="/customers" variant="ghost">
            Lista clienti
          </BGButton>
        </div>
      </BGCard>

      <BGPremiumSectionNav
        items={sectionNavItems}
        activeKey={activeSection}
        onChange={setActiveSection}
        ariaLabel="Sezioni scheda cliente"
      />

      {activeSection === "overview" ? (
        <section className="section-panel">
          <div className="operations-grid">
            <div className="situation-card">
              <div className="situation-top">
                <div>
                  <div className="bg-eyebrow">Situazione cliente</div>
                  <h2 className="situation-title">{currentPlanName}</h2>
                  <div className="situation-subtitle">
                    Stato immediato per reception:{" "}
                    {subscriptionStatus.toLowerCase()} · accesso{" "}
                    {accessAllowed ? "consentito" : "da verificare"}
                  </div>
                </div>
                <BGStatusBadge tone={subscriptionTone}>
                  {subscriptionStatus}
                </BGStatusBadge>
              </div>

              <div
                className={`access-decision-strip ${accessAllowed ? "allowed" : "denied"}`}
              >
                <div>
                  <div className="access-decision-label">
                    Decisione accesso reception
                  </div>
                  <div className="access-decision-value">
                    {accessAllowed ? "Può entrare" : "Non può entrare"}
                  </div>
                </div>
                <div className="access-check-grid">
                  {accessDecisionChecks.map((check) => (
                    <span
                      className={`access-check-pill ${check.ok ? "ok" : "ko"}`}
                      key={check.label}
                    >
                      {check.ok ? "✓" : "!"} {check.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="situation-kpis">
                <div className="situation-kpi">
                  <span>Piano attivo</span>
                  <strong>{currentPlanName}</strong>
                </div>
                <div className="situation-kpi">
                  <span>Inizio</span>
                  <strong>
                    {formatDateIT(
                      activeSubscriptionStart || plannedSubscriptionStart,
                    )}
                  </strong>
                </div>
                <div className="situation-kpi">
                  <span>Fine</span>
                  <strong>
                    {formatDateIT(
                      activeSubscriptionEnd ||
                        String(plannedSubscription?.ends_at || "").slice(0, 10),
                    )}
                  </strong>
                </div>
                <div className="situation-kpi">
                  <span>Giorni residui</span>
                  <strong>
                    {daysRemaining !== null
                      ? `${Math.max(daysRemaining, 0)} giorni`
                      : "-"}
                  </strong>
                </div>
                <div className="situation-kpi">
                  <span>Stato abbonamento</span>
                  <strong>{subscriptionStatus}</strong>
                </div>
                <div className="situation-kpi">
                  <span>Certificato medico</span>
                  <strong>{certificateStatusLabel}</strong>
                </div>
                <div className="situation-kpi">
                  <span>Quota associativa</span>
                  <strong>{membershipStatusLabel}</strong>
                </div>
                <div className="situation-kpi">
                  <span>Ultimo rinnovo</span>
                  <strong>{lastRenewalAmount}</strong>
                </div>
              </div>

              {customerAlerts.length > 0 ? (
                <div className="alert-stack">
                  {customerAlerts.map((alert) => (
                    <div className="alert-chip" key={alert}>
                      {alert}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="alert-chip"
                  style={{
                    borderColor: "rgba(74, 222, 128, .25)",
                    background: "rgba(22, 101, 52, .22)",
                    color: "#bbf7d0",
                  }}
                >
                  Nessun alert operativo: cliente regolare per abbonamento,
                  quota, certificato e blocchi.
                </div>
              )}
            </div>

            <div className="compact-side-stack">
              <BGCard variant="soft">
                <BGSectionHeader
                  title="Anagrafica compatta"
                  subtitle="Dati essenziali senza aprire la modifica."
                  actions={
                    <BGButton
                      variant="ghost"
                      onClick={() => setActiveSection("profile")}
                    >
                      Dettaglio
                    </BGButton>
                  }
                />
                <div className="compact-info-list">
                  {compactProfileInfo.map((item) => (
                    <div className="compact-info-row" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </BGCard>
              <BGCard variant={accessAllowed ? "success" : "warning"}>
                <BGSectionHeader
                  title="Accesso"
                  subtitle="Sintesi badge, QR/Mobile Pass e ultimo varco."
                  actions={
                    <BGButton
                      variant="ghost"
                      onClick={() => setActiveSection("access")}
                    >
                      Gestisci
                    </BGButton>
                  }
                />
                <div className="info-grid">
                  <InfoMini
                    label="Badge"
                    value={badgeDisplay}
                    tone={
                      customer.badge_code || customer.controller_code
                        ? "success"
                        : "danger"
                    }
                  />
                  <InfoMini
                    label="QR DNake"
                    value={activeDnakeQr ? "Attivo" : "Non generato"}
                    tone={activeDnakeQr ? "success" : "danger"}
                  />
                  <InfoMini
                    label="Mobile Pass"
                    value={mobilePassStatus}
                    tone="neutral"
                  />
                  <InfoMini
                    label="Ultimo accesso"
                    value={
                      lastAccess
                        ? new Date(lastAccess.access_time).toLocaleString()
                        : "-"
                    }
                    tone={
                      lastAccess?.was_allowed
                        ? "success"
                        : lastAccess
                          ? "danger"
                          : "neutral"
                    }
                  />
                </div>
              </BGCard>
            </div>
          </div>

          <section
            className="operations-center"
            aria-label="Centro operativo cliente"
          >
            <BGSectionHeader
              title="Centro operativo cliente"
              subtitle="Mini-dashboard premium per reception, amministrazione, documenti e storico cliente."
            />

            <div className="operations-center-grid">
              <OverviewCard
                eyebrow="Piano"
                title="Abbonamento"
                status={subscriptionStatus}
                tone={subscriptionTone}
                value={
                  activeSubscription
                    ? `${activeSubscription.subscription_plans?.name || "Attivo"}`
                    : plannedSubscription
                      ? "Pianificato"
                      : "Da rinnovare"
                }
                note={
                  activeSubscription
                    ? `Scade il ${formatDateIT(activeSubscription.ends_at)}`
                    : plannedSubscription
                      ? `Parte il ${formatDateIT(plannedSubscription.starts_at)}`
                      : "Nessun piano attivo registrato per oggi"
                }
                action="Gestisci piano"
                onAction={() => {
                  setActiveSection("subscriptions");
                  setShowSubscriptionHistory(true);
                }}
              >
                <span className="operation-detail-pill">
                  {daysRemaining !== null
                    ? `${Math.max(daysRemaining, 0)} giorni residui`
                    : "Verifica piano"}
                </span>
              </OverviewCard>
              <OverviewCard
                eyebrow="Associazione"
                title="Quota associativa"
                status={activeMembership ? "Regolare" : "Da verificare"}
                tone={activeMembership ? "success" : "warning"}
                value={activeMembership ? "Regolare" : "Da rinnovare"}
                note={
                  activeMembership
                    ? `Valida fino al ${formatDateIT(activeMembership.valid_until)}`
                    : membershipFees.length > 0
                      ? "Quota presente ma non valida oggi"
                      : "Nessuna quota associativa registrata"
                }
                action="Gestisci quota"
                onAction={() => {
                  setActiveSection("subscriptions");
                  setShowMembershipHistory(true);
                }}
              />
              <OverviewCard
                eyebrow="Medico"
                title="Certificato medico"
                status={certificateValid ? "Valido" : "Critico"}
                tone={certificateValid ? "success" : "danger"}
                value={
                  certificateValid ? "Certificato valido" : "Da verificare"
                }
                note={
                  certificateValid
                    ? `Scade il ${formatDateIT(medicalCertificateEnd)}`
                    : medicalCertificateEnd
                      ? `Scaduto il ${formatDateIT(medicalCertificateEnd)}`
                      : "Upload o rinnovo richiesto"
                }
                action="Apri documenti"
                onAction={() => setActiveSection("documents")}
              />
              <OverviewCard
                eyebrow="Cassa"
                title="Pagamenti"
                status="Storico"
                tone="info"
                value="Storico pagamenti"
                note="Apri la sezione cassa per importi reali, rettifiche e annullamenti tracciati."
                action="Apri cassa"
                onAction={() => setActiveSection("payments")}
              >
                <span className="operation-detail-pill">
                  Dati reali nello storico dedicato
                </span>
              </OverviewCard>
              <OverviewCard
                eyebrow="Fiscale"
                title="Ricevute"
                status="Registro"
                tone="info"
                value="Ricevute cliente"
                note="Registro ricevute e ristampe A4 mantenuti nella sezione pagamenti."
                action="Vedi ricevute"
                onAction={() => setActiveSection("payments")}
              />
              <OverviewCard
                eyebrow="Gate"
                title="Accessi"
                status={accessAllowed ? "Consentiti" : "Verifica"}
                tone={accessAllowed ? "success" : "warning"}
                value={accessAllowed ? "Può entrare" : "Da verificare"}
                note={
                  lastAccess
                    ? `Ultimo evento: ${new Date(lastAccess.access_time).toLocaleString()}`
                    : "Nessun accesso recente registrato"
                }
                action="Verifica accessi"
                onAction={() => setActiveSection("access")}
              >
                <div className="overview-list">
                  {recentAccessLogs.length === 0 ? (
                    <span>Nessun evento varco da mostrare</span>
                  ) : (
                    recentAccessLogs.map((log) => (
                      <span key={log.id}>
                        {log.was_allowed ? "Consentito" : "Negato"} ·{" "}
                        {new Date(log.access_time).toLocaleString()}
                      </span>
                    ))
                  )}
                </div>
              </OverviewCard>
              <OverviewCard
                eyebrow="Reception"
                title="Note"
                status={recentNotes.length === 0 ? "Pulito" : "Da leggere"}
                tone={recentNotes.length === 0 ? "success" : "warning"}
                value={`${notes.length} ${notes.length === 1 ? "nota" : "note"}`}
                note={
                  recentNotes[0]?.note ||
                  "Nessuna nota urgente per la reception"
                }
                action="Gestisci note"
                onAction={() => setActiveSection("timeline")}
              />
              <OverviewCard
                eyebrow="CRM"
                title="Timeline recente"
                status="Aggiornata"
                tone="info"
                value="Attività cliente"
                note="Preview rapida: apri la timeline per lo storico completo multi-fonte."
                action="Apri timeline"
                onAction={() => setActiveSection("timeline")}
              >
                <div className="overview-list">
                  {recentTimelineEvents.length === 0 ? (
                    <span>Nessun evento recente da mostrare</span>
                  ) : (
                    recentTimelineEvents.map((event) => (
                      <span key={event.key}>
                        {event.title} ·{" "}
                        {event.date
                          ? new Date(event.date).toLocaleDateString()
                          : "-"}
                      </span>
                    ))
                  )}
                </div>
              </OverviewCard>
            </div>
          </section>
        </section>
      ) : null}

      {activeSection === "profile" ? (
        <section className="content-grid">
          <BGCard variant="premium">
            <BGSectionHeader
              title="Profilo cliente"
              subtitle="Dati anagrafici completi e modifica professionale."
              actions={
                !isEditingCustomer ? (
                  <BGButton variant="secondary" onClick={startEditCustomer}>
                    Modifica anagrafica
                  </BGButton>
                ) : null
              }
            />
            <div className="info-grid">
              {customerInfo.map((item) => (
                <InfoMini
                  key={item.label}
                  label={item.label}
                  value={item.value}
                />
              ))}
              <InfoMini label="Badge" value={customer.badge_code || "-"} />
              <InfoMini
                label="Controller"
                value={customer.controller_code || "-"}
              />
              <InfoMini
                label="Note reception"
                value={customer.reception_notes || "-"}
              />
            </div>
          </BGCard>

          <div className="section-panel">
            <CustomerPhotoUpload
              customerId={customer.id}
              currentPhotoUrl={customer.photo_url}
              onUploaded={(url) =>
                setCustomer((prev: any) => ({ ...prev, photo_url: url }))
              }
            />
          </div>

          {isEditingCustomer ? (
            <BGCard variant="warning" className="edit-panel">
              <BGSectionHeader
                title="Modifica anagrafica professionale"
                subtitle="Aggiorna dati cliente, credenziali principali e stato attività."
                actions={
                  <div className="actions-inline">
                    <BGButton
                      variant="ghost"
                      onClick={cancelEditCustomer}
                      disabled={savingCustomer}
                    >
                      Annulla
                    </BGButton>
                    <BGButton
                      onClick={saveCustomerProfile}
                      disabled={savingCustomer}
                    >
                      {savingCustomer ? "Salvataggio..." : "Salva"}
                    </BGButton>
                  </div>
                }
              />
              <div className="form-grid">
                <EditField label="Nome">
                  <input
                    value={editForm.first_name || ""}
                    onChange={(e) =>
                      updateEditField("first_name", e.target.value)
                    }
                  />
                </EditField>
                <EditField label="Cognome">
                  <input
                    value={editForm.last_name || ""}
                    onChange={(e) =>
                      updateEditField("last_name", e.target.value)
                    }
                  />
                </EditField>
                <EditField label="Telefono">
                  <input
                    value={editForm.phone || ""}
                    onChange={(e) => updateEditField("phone", e.target.value)}
                  />
                </EditField>
                <EditField label="Email">
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => updateEditField("email", e.target.value)}
                  />
                </EditField>
                <EditField label="Codice fiscale">
                  <input
                    value={editForm.fiscal_code || ""}
                    onChange={(e) =>
                      updateEditField(
                        "fiscal_code",
                        e.target.value.toUpperCase(),
                      )
                    }
                  />
                </EditField>
                <EditField label="Data nascita">
                  <input
                    type="date"
                    value={editForm.birth_date || ""}
                    onChange={(e) =>
                      updateEditField("birth_date", e.target.value)
                    }
                  />
                </EditField>
                <EditField label="Sesso">
                  <select
                    value={editForm.gender || ""}
                    onChange={(e) => updateEditField("gender", e.target.value)}
                  >
                    <option value="">Non specificato</option>
                    <option value="M">Maschile</option>
                    <option value="F">Femminile</option>
                    <option value="ALTRO">Altro</option>
                  </select>
                </EditField>
                <EditField label="Indirizzo">
                  <input
                    value={editForm.address || ""}
                    onChange={(e) => updateEditField("address", e.target.value)}
                  />
                </EditField>
                <EditField label="Città">
                  <input
                    value={editForm.city || ""}
                    onChange={(e) => updateEditField("city", e.target.value)}
                  />
                </EditField>
                <EditField label="CAP">
                  <input
                    value={editForm.postal_code || ""}
                    onChange={(e) =>
                      updateEditField("postal_code", e.target.value)
                    }
                  />
                </EditField>
                <EditField label="Contatto emergenza">
                  <input
                    value={editForm.emergency_contact_name || ""}
                    onChange={(e) =>
                      updateEditField("emergency_contact_name", e.target.value)
                    }
                  />
                </EditField>
                <EditField label="Telefono emergenza">
                  <input
                    value={editForm.emergency_contact_phone || ""}
                    onChange={(e) =>
                      updateEditField("emergency_contact_phone", e.target.value)
                    }
                  />
                </EditField>
                <EditField label="Badge principale">
                  <input
                    value={editForm.badge_code || ""}
                    onChange={(e) =>
                      updateEditField("badge_code", e.target.value)
                    }
                  />
                </EditField>
                <EditField label="Codice bridge calcolato">
                  <input value={editForm.controller_code || "-"} readOnly />
                </EditField>
                <EditField label="Stato cliente">
                  <div className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={!!editForm.is_active}
                      onChange={(e) =>
                        updateEditField("is_active", e.target.checked)
                      }
                    />
                    <span>
                      {editForm.is_active
                        ? "Cliente attivo"
                        : "Cliente disattivato"}
                    </span>
                  </div>
                </EditField>
                <EditField label="Note reception" full>
                  <textarea
                    value={editForm.reception_notes || ""}
                    onChange={(e) =>
                      updateEditField("reception_notes", e.target.value)
                    }
                    placeholder="Note interne rapide visibili alla reception..."
                  />
                </EditField>
              </div>
            </BGCard>
          ) : null}
        </section>
      ) : null}

      {activeSection === "subscriptions" ? (
        <section className="section-panel">
          <div className="content-grid">
            <BGCard variant="premium">
              <BGSectionHeader
                title="Rinnovo rapido + pagamento"
                subtitle="Prepara quota associativa e rinnovo guidato: importo, metodo, periodo e ricevuta automatica."
              />

              <div className="manual-renew-box" style={{ marginBottom: 16 }}>
                <BGSectionHeader
                  title="Associazione / Quota associativa"
                  subtitle="Registra o rinnova la quota pagata generando pagamento, ricevuta ufficiale e storico cliente."
                />

                <div className="form-grid" style={{ marginTop: 14 }}>
                  <EditField label="Importo quota">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={membershipAmount}
                      onChange={(e) => setMembershipAmount(e.target.value)}
                    />
                  </EditField>

                  <EditField label="Metodo pagamento">
                    <select
                      value={membershipPaymentMethod}
                      onChange={(e) => setMembershipPaymentMethod(e.target.value)}
                    >
                      <option value="cash">Contanti</option>
                      <option value="pos">POS</option>
                      <option value="bank_transfer">Bonifico</option>
                    </select>
                  </EditField>

                  <EditField label="Data inizio validità">
                    <input
                      type="date"
                      value={membershipValidFrom}
                      onChange={(e) => setMembershipValidFrom(e.target.value)}
                    />
                  </EditField>

                  <EditField label="Data fine validità">
                    <input
                      type="date"
                      value={membershipValidUntil}
                      onChange={(e) => setMembershipValidUntil(e.target.value)}
                    />
                  </EditField>
                </div>

                <div className="payment-box" style={{ marginTop: 14 }}>
                  <div className="small-muted" style={{ marginBottom: 8 }}>
                    Riepilogo quota associativa
                  </div>
                  <div className="info-grid">
                    <InfoMini
                      label="Descrizione ricevuta"
                      value={`Quota associativa Body Energy ASD anno ${membershipValidFrom ? membershipValidFrom.slice(0, 4) : "-"}`}
                    />
                    <InfoMini
                      label="Periodo"
                      value={`${formatDateIT(membershipValidFrom)} → ${formatDateIT(membershipValidUntil)}`}
                    />
                    <InfoMini
                      label="Importo"
                      value={`€ ${Number(String(membershipAmount).replace(",", ".") || 0).toFixed(2)}`}
                    />
                    <InfoMini
                      label="Pagamento"
                      value={paymentMethodLabel(membershipPaymentMethod)}
                    />
                  </div>
                  <div className="small-muted" style={{ marginTop: 10 }}>
                    Alla conferma BodyGate creerà customer_payments, payments,
                    customer_receipts numerata e timeline cliente. Nessuna
                    prima nota o cash movement viene generato.
                  </div>
                </div>

                {membershipFeedback ? (
                  <div className="payment-box" style={{ marginTop: 14 }}>
                    <div className="history-title">Quota registrata</div>
                    <div className="history-period">
                      {membershipFeedback.split("\n").map((line) => (
                        <span key={line || "blank"}>
                          {line}
                          <br />
                        </span>
                      ))}
                    </div>
                    {membershipReceiptUrl ? (
                      <div className="actions" style={{ marginTop: 10 }}>
                        <BGButton
                          variant="secondary"
                          onClick={() => window.open(membershipReceiptUrl, "_blank")}
                        >
                          Apri ricevuta generata
                        </BGButton>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="actions" style={{ marginTop: 16 }}>
                  <BGButton
                    onClick={() => renewMembershipFee()}
                    disabled={membershipSaving}
                  >
                    {membershipSaving
                      ? "Registrazione quota..."
                      : "Salva quota e genera ricevuta"}
                  </BGButton>
                  <BGButton
                    variant="ghost"
                    onClick={() => setActiveSection("payments")}
                  >
                    Storico ricevute
                  </BGButton>
                </div>
              </div>

              <div className="payment-box">
                <div className="small-muted" style={{ marginBottom: 8 }}>
                  Metodo pagamento
                </div>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                >
                  <option value="cash">Contanti</option>
                  <option value="pos">POS</option>
                  <option value="bank_transfer">Bonifico</option>
                </select>
              </div>

              <div className="quick-plan-grid">
                {shortPlans.length === 0 ? (
                  <BGEmptyState
                    title="Nessun piano attivo"
                    description="Configura i piani abbonamento per abilitare il rinnovo rapido."
                  />
                ) : null}

                {shortPlans.map((plan) => {
                  const price = Number(plan.promo_price || plan.price || 0);
                  const duration = Number(plan.duration_days || 0);
                  const planDisplayName = formatPlanDisplayName(plan.name);

                  return (
                    <BGButton
                      key={plan.id}
                      className="quick-plan-btn bg-plan-card"
                      onClick={() => openRenewalPanel(plan.id)}
                    >
                      <span className="plan-copy">
                        <span className="plan-title">
                          {planDisplayName.title}
                        </span>
                        {planDisplayName.days ? (
                          <span className="plan-days">
                            {planDisplayName.days}
                          </span>
                        ) : null}
                      </span>
                      <span className="plan-meta">
                        <strong className="plan-price">
                          € {price.toFixed(2)}
                        </strong>
                        <BGStatusBadge tone="info">{`${duration} giorni`}</BGStatusBadge>
                      </span>
                    </BGButton>
                  );
                })}
              </div>

              <div className="manual-renew-box">
                <div className="small-muted" style={{ marginBottom: 10 }}>
                  Rinnovo manuale / piano personalizzato
                </div>
                <div className="actions">
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                  >
                    <option value="">Seleziona piano</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - €
                        {Number(plan.promo_price || plan.price || 0).toFixed(2)}{" "}
                        - {plan.duration_days} giorni
                      </option>
                    ))}
                  </select>
                  <BGButton
                    variant="secondary"
                    onClick={() => openRenewalPanel()}
                  >
                    Prepara rinnovo
                  </BGButton>
                </div>
              </div>

              {renewalOpen ? (
                <div className="manual-renew-box" style={{ marginTop: 16 }}>
                  <BGSectionHeader
                    title="Conferma rinnovo guidato"
                    subtitle="Controlla periodo, importo e pagamento prima di generare abbonamento e ricevuta."
                  />

                  <div className="info-grid">
                    <InfoMini label="Cliente" value={customerName} />
                    <InfoMini
                      label="Stato attuale"
                      value={
                        activeSubscription?.ends_at
                          ? `Attivo fino al ${formatDateIT(activeSubscription.ends_at)}`
                          : "Da rinnovare"
                      }
                      tone={activeSubscription ? "success" : "danger"}
                    />
                  </div>

                  <div className="form-grid" style={{ marginTop: 14 }}>
                    <EditField label="Piano">
                      <select
                        value={renewalPlanId}
                        onChange={(e) => updateRenewalPlan(e.target.value)}
                      >
                        <option value="">Seleziona piano</option>
                        {plans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name} - €
                            {Number(
                              plan.promo_price || plan.price || 0,
                            ).toFixed(2)}{" "}
                            - {plan.duration_days} giorni
                          </option>
                        ))}
                      </select>
                    </EditField>

                    <EditField label="Data inizio">
                      <input
                        type="date"
                        value={renewalStartDate}
                        onChange={(e) => updateRenewalStartDate(e.target.value)}
                      />
                    </EditField>

                    <EditField label="Data fine">
                      <input type="date" value={renewalEndDate} readOnly />
                    </EditField>

                    <EditField label="Importo pagato">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={renewalAmount}
                        onChange={(e) => setRenewalAmount(e.target.value)}
                      />
                    </EditField>

                    <EditField label="Metodo pagamento">
                      <select
                        value={selectedPaymentMethod}
                        onChange={(e) =>
                          setSelectedPaymentMethod(e.target.value)
                        }
                      >
                        <option value="cash">Contanti</option>
                        <option value="pos">POS</option>
                        <option value="bank_transfer">Bonifico</option>
                      </select>
                    </EditField>

                    <EditField label="Note rinnovo" full>
                      <textarea
                        value={renewalNotes}
                        onChange={(e) => setRenewalNotes(e.target.value)}
                        placeholder="Esempio: partenza posticipata, sconto applicato, recupero giorni..."
                      />
                    </EditField>
                  </div>

                  {getRenewalWarnings().length > 0 ? (
                    <div className="payment-box" style={{ marginTop: 14 }}>
                      <div className="small-muted" style={{ marginBottom: 8 }}>
                        Avvisi rinnovo
                      </div>
                      <div className="history-list">
                        {getRenewalWarnings().map((warning) => (
                          <div key={warning} className="history-row">
                            <div className="history-main">
                              <div className="history-title">Attenzione</div>
                              <div className="history-period">{warning}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="payment-box" style={{ marginTop: 14 }}>
                    <div className="small-muted" style={{ marginBottom: 8 }}>
                      Riepilogo finale
                    </div>
                    <div className="info-grid">
                      <InfoMini
                        label="Piano"
                        value={getRenewalPlan()?.name || "-"}
                      />
                      <InfoMini
                        label="Periodo"
                        value={`${formatDateIT(renewalStartDate)} → ${formatDateIT(renewalEndDate)}`}
                      />
                      <InfoMini
                        label="Importo"
                        value={`€ ${Number(String(renewalAmount).replace(",", ".") || 0).toFixed(2)}`}
                      />
                      <InfoMini
                        label="Pagamento"
                        value={paymentMethodLabel(selectedPaymentMethod)}
                      />
                    </div>
                    <div className="small-muted" style={{ marginTop: 10 }}>
                      Alla conferma BodyGate creerà abbonamento, pagamento,
                      ricevuta e timeline cliente.
                    </div>
                  </div>

                  <div className="actions" style={{ marginTop: 16 }}>
                    <BGButton
                      variant="secondary"
                      onClick={() => setRenewalOpen(false)}
                      disabled={renewalSaving}
                    >
                      Annulla
                    </BGButton>
                    <BGButton
                      onClick={() => renewSubscription()}
                      disabled={renewalSaving}
                    >
                      {renewalSaving
                        ? "Rinnovo in corso..."
                        : "Conferma rinnovo"}
                    </BGButton>
                  </div>
                </div>
              ) : null}
            </BGCard>

            <BGCard variant="soft">
              <BGSectionHeader
                title="Stato abbonamento"
                subtitle="Situazione operativa del cliente e storico consultabile su richiesta."
              />

              <div className="info-grid">
                <InfoMini
                  label="Abbonamento attuale"
                  value={
                    activeSubscription
                      ? `${activeSubscription.subscription_plans?.name || "Attivo"} · fino al ${activeSubscription.ends_at}`
                      : "Nessun abbonamento attivo"
                  }
                  tone={activeSubscription ? "success" : "danger"}
                />

                <InfoMini
                  label="Prossimo rinnovo"
                  value={
                    plannedSubscription
                      ? `${plannedSubscription.subscription_plans?.name || "Pianificato"} · dal ${plannedSubscription.starts_at}`
                      : "Nessun rinnovo pianificato"
                  }
                  tone={plannedSubscription ? "success" : "neutral"}
                />

                <InfoMini
                  label="Quota associativa"
                  value={
                    activeMembership
                      ? `Valida fino al ${activeMembership.valid_until}`
                      : "Da rinnovare"
                  }
                  tone={activeMembership ? "success" : "danger"}
                />

                <InfoMini
                  label="Accesso"
                  value={accessAllowed ? "Operativo" : "Da verificare"}
                  tone={accessAllowed ? "success" : "danger"}
                />
              </div>

              <div className="payment-box" style={{ marginTop: 14 }}>
                <div className="small-muted" style={{ marginBottom: 8 }}>
                  Consultazione storici
                </div>

                <div className="actions">
                  <BGButton
                    variant="secondary"
                    onClick={() => setShowSubscriptionHistory((prev) => !prev)}
                  >
                    {showSubscriptionHistory
                      ? "Nascondi storico abbonamenti"
                      : "Mostra storico abbonamenti"}
                  </BGButton>

                  <BGButton
                    variant="secondary"
                    onClick={() => setShowMembershipHistory((prev) => !prev)}
                  >
                    {showMembershipHistory
                      ? "Nascondi storico quota"
                      : "Mostra storico quota"}
                  </BGButton>
                </div>
              </div>
            </BGCard>
          </div>

          {editingSubscriptionId ? (
            <BGCard variant="warning">
              <BGSectionHeader
                title="Modifica abbonamento selezionato"
                subtitle="Correggi piano, periodo, importo, metodo pagamento e note operative."
                actions={
                  <div className="actions-inline">
                    <BGButton
                      variant="ghost"
                      onClick={cancelEditSubscription}
                      disabled={savingSubscriptionEdit}
                    >
                      Annulla
                    </BGButton>
                    <BGButton
                      onClick={saveSubscriptionEdit}
                      disabled={savingSubscriptionEdit}
                    >
                      {savingSubscriptionEdit
                        ? "Salvataggio..."
                        : "Salva modifiche"}
                    </BGButton>
                  </div>
                }
              />

              <div className="form-grid">
                <EditField label="Piano">
                  <select
                    value={subscriptionEditForm.plan_id || ""}
                    onChange={(e) =>
                      updateSubscriptionEditField("plan_id", e.target.value)
                    }
                  >
                    <option value="">Seleziona piano</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - €
                        {Number(plan.promo_price || plan.price || 0).toFixed(2)}{" "}
                        - {plan.duration_days} giorni
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Data inizio">
                  <input
                    type="date"
                    value={subscriptionEditForm.starts_at || ""}
                    onChange={(e) =>
                      updateSubscriptionEditField("starts_at", e.target.value)
                    }
                  />
                </EditField>

                <EditField label="Data fine">
                  <input
                    type="date"
                    value={subscriptionEditForm.ends_at || ""}
                    onChange={(e) =>
                      updateSubscriptionEditField("ends_at", e.target.value)
                    }
                  />
                </EditField>

                <EditField label="Importo">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={subscriptionEditForm.amount || ""}
                    onChange={(e) =>
                      updateSubscriptionEditField("amount", e.target.value)
                    }
                  />
                </EditField>

                <EditField label="Metodo pagamento">
                  <select
                    value={subscriptionEditForm.payment_method || "cash"}
                    onChange={(e) =>
                      updateSubscriptionEditField(
                        "payment_method",
                        e.target.value,
                      )
                    }
                  >
                    <option value="cash">Contanti</option>
                    <option value="pos">POS</option>
                    <option value="bank_transfer">Bonifico</option>
                  </select>
                </EditField>

                <EditField label="Note modifica" full>
                  <textarea
                    value={subscriptionEditForm.notes || ""}
                    onChange={(e) =>
                      updateSubscriptionEditField("notes", e.target.value)
                    }
                    placeholder="Esempio: correzione data, piano errato, importo corretto..."
                  />
                </EditField>
              </div>

              <div className="small-muted" style={{ marginTop: 12 }}>
                Nota: questa modifica aggiorna l'abbonamento e la timeline. Non
                modifica la ricevuta A4 già emessa.
              </div>
            </BGCard>
          ) : null}

          {showSubscriptionHistory ? (
            <HistoryCard
              title="Storico abbonamenti"
              subtitle="Tutti i rinnovi registrati per il cliente."
            >
              <div className="history-list">
                {subscriptions.length === 0 ? (
                  <BGEmptyState title="Nessun abbonamento" />
                ) : (
                  subscriptions.map((sub) => (
                    <SubscriptionHistoryRow
                      key={sub.id}
                      subscription={sub}
                      today={today}
                      onEdit={() => openEditSubscription(sub)}
                      onCancel={() => cancelSubscriptionRecord(sub)}
                    />
                  ))
                )}
              </div>
            </HistoryCard>
          ) : null}

          {showMembershipHistory ? (
            <HistoryCard
              title="Storico quota associativa"
              subtitle="Quote annuali registrate."
            >
              <div className="history-list">
                {membershipFees.length === 0 ? (
                  <BGEmptyState title="Nessuna quota registrata" />
                ) : (
                  membershipFees.map((fee) => (
                    <MembershipFeeHistoryRow
                      key={fee.id}
                      fee={fee}
                      today={today}
                    />
                  ))
                )}
              </div>
            </HistoryCard>
          ) : null}
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
            <BGSectionHeader
              title="Credenziali accesso"
              subtitle="RFID/NFC, QR DNake, Mobile Pass e WhatsApp."
            />
            <div className="credential-summary">
              <InfoMini
                label="RFID / NFC"
                value={`${cardCredentials.length} attive`}
              />
              <InfoMini
                label="QR DNake"
                value={activeDnakeQr ? "Attivo" : "Non generato"}
                tone={activeDnakeQr ? "success" : "danger"}
              />
            </div>
            <div className="credential-section">
              <div className="credential-section-title">Tessere / Card</div>
              {customer.badge_code || customer.controller_code ? (
                <div className="badge-card-panel">
                  <div className="badge-card-main">
                    <div>
                      <div className="small-muted">Codice badge attuale</div>
                      <div className="badge-card-code">
                        {customer.badge_code || customer.controller_code}
                      </div>
                    </div>
                    <BGStatusBadge tone="success">
                      Badge collegato
                    </BGStatusBadge>
                  </div>
                  {cardCredentials.length > 0 ? (
                    <div className="credential-pill-list">
                      {cardCredentials.map((item) => (
                        <span className="credential-pill" key={item.id}>
                          {String(item.type).toUpperCase()} ·{" "}
                          {item.controller_code || item.code}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="actions">
                    <BGButton variant="secondary" onClick={openBadgePanel}>
                      Modifica badge
                    </BGButton>
                  </div>
                </div>
              ) : (
                <>
                  <BGEmptyState
                    title="Nessuna tessera associata"
                    description="Associa un badge fisico al cliente salvandolo in anagrafica."
                  />
                  {cardCredentials.length > 0 ? (
                    <div className="credential-pill-list">
                      {cardCredentials.map((item) => (
                        <span className="credential-pill" key={item.id}>
                          {String(item.type).toUpperCase()} ·{" "}
                          {item.controller_code || item.code}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <BGButton onClick={openBadgePanel}>Assegna badge</BGButton>
                </>
              )}
              {badgePanelOpen ? (
                <div className="badge-edit-panel">
                  <div className="edit-field">
                    <label>Codice badge</label>
                    <input
                      autoFocus
                      value={badgeDraft}
                      onChange={(event) => setBadgeDraft(event.target.value)}
                      placeholder="Es. RFID-001234"
                    />
                  </div>
                  <div className="actions">
                    <BGButton onClick={saveBadgeCode} disabled={badgeSaving}>
                      {badgeSaving ? "Salvataggio..." : "Salva badge"}
                    </BGButton>
                    <BGButton
                      variant="ghost"
                      onClick={cancelBadgePanel}
                      disabled={badgeSaving}
                    >
                      Annulla
                    </BGButton>
                  </div>
                </div>
              ) : null}
              {badgeFeedback ? (
                <div
                  className={`badge-feedback badge-feedback-${badgeFeedback.tone}`}
                >
                  {badgeFeedback.message}
                </div>
              ) : null}
            </div>
            <div className="credential-section">
              <div className="credential-section-title">QR Code DNake</div>
              {activeDnakeQr ? (
                <>
                  {qrDataUrl ? (
                    <div className="qr-box">
                      <img src={qrDataUrl} alt="QR DNake" />
                    </div>
                  ) : (
                    <BGEmptyState title="Generazione immagine QR" />
                  )}
                  <div className="info-grid">
                    <InfoMini
                      label="ID DNake"
                      value={activeDnakeQr.dnake_user_id || "-"}
                    />
                    <InfoMini
                      label="Nome DNake"
                      value={activeDnakeQr.dnake_name || "-"}
                    />
                    <InfoMini
                      label="Stato"
                      value={activeDnakeQr.qr_status || "-"}
                    />
                  </div>
                  <div className="actions">
                    <BGButton
                      variant="secondary"
                      onClick={printQr}
                      disabled={!qrDataUrl}
                    >
                      Visualizza / stampa
                    </BGButton>
                    <BGButton onClick={generateDnakeQr} disabled={qrGenerating}>
                      {qrGenerating ? "Rigenero..." : "Rigenera QR"}
                    </BGButton>
                  </div>
                </>
              ) : (
                <>
                  <BGEmptyState
                    title="Nessun QR DNake"
                    description="Genera un QR DNake per abilitare il passaggio cliente."
                  />
                  <BGButton onClick={generateDnakeQr} disabled={qrGenerating}>
                    {qrGenerating ? "Generazione..." : "Genera QR DNake"}
                  </BGButton>
                </>
              )}
              {qrCredentials.length > 0 ? (
                <div className="small-muted">
                  Credenziali QR salvate: {qrCredentials.length}
                </div>
              ) : null}
            </div>
            <div className="credential-section">
              <div className="credential-section-title">
                Mobile Pass / WhatsApp
              </div>
              <BGEmptyState
                title="Mobile Pass cliente"
                description="Crea il link personale e invialo su WhatsApp senza cambiare la logica esistente."
              />
              {mobilePassUrl ? (
                <div className="mobile-pass-url">{mobilePassUrl}</div>
              ) : null}
              <div className="actions">
                <BGButton
                  variant="secondary"
                  onClick={createOrGetMobilePass}
                  disabled={mobilePassLoading}
                >
                  {mobilePassLoading ? "Creo link..." : "Genera Pass Mobile"}
                </BGButton>
                <BGButton
                  onClick={() => {
                    void sendMobilePassWhatsApp();
                  }}
                  disabled={mobilePassLoading}
                >
                  Invia su WhatsApp
                </BGButton>
                <BGButton
                  variant="secondary"
                  onClick={copyMobilePassLink}
                  disabled={mobilePassLoading}
                >
                  Copia link
                </BGButton>
              </div>
              {!customer?.phone ? (
                <div className="danger-text small-muted">
                  Telefono cliente mancante: WhatsApp si aprirà senza
                  destinatario.
                </div>
              ) : null}
            </div>
          </BGCard>

          <div className="section-panel">
            <BGCard variant={activeBlock ? "danger" : "soft"}>
              <BGSectionHeader
                title="Blocchi cliente"
                subtitle="Gestione blocchi operativi senza modificare access control."
              />
              <div className="actions">
                <input
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Motivo blocco..."
                />
                <BGButton variant="danger" onClick={addBlock}>
                  Blocca
                </BGButton>
              </div>
              {blocks.length === 0 ? (
                <BGEmptyState title="Nessun blocco presente" />
              ) : (
                blocks.map((block) => (
                  <div className="row" key={block.id}>
                    <div>
                      <div className="row-title">{block.reason}</div>
                      <div className="row-subtitle">
                        Stato: {block.is_active ? "Attivo" : "Disattivato"}
                      </div>
                    </div>
                    {block.is_active ? (
                      <BGButton
                        variant="secondary"
                        onClick={() => disableBlock(block.id)}
                      >
                        Sblocca
                      </BGButton>
                    ) : null}
                  </div>
                ))
              )}
            </BGCard>
            <HistoryCard
              title="Ultimi accessi"
              subtitle="Storico accessi leggibile e compatto."
            >
              {accessLogs.length === 0 ? (
                <BGEmptyState title="Nessun accesso registrato" />
              ) : (
                accessLogs.map((log) => (
                  <InfoRow
                    key={log.id}
                    title={
                      log.was_allowed ? "Accesso consentito" : "Accesso negato"
                    }
                    subtitle={new Date(log.access_time).toLocaleString()}
                    right={log.reason || "-"}
                  />
                ))
              )}
            </HistoryCard>
          </div>
        </section>
      ) : null}

      {activeSection === "documents" ? (
        <section className="content-grid">
          <MedicalCertificateCard
            customerId={customer.id}
            currentCertificateUrl={customer.medical_certificate_url}
            startDate={
              customer.medical_certificate_start_date ||
              customer.medical_certificate_start
            }
            endDate={
              customer.medical_certificate_end_date ||
              customer.medical_certificate_end
            }
            onUpdated={(data) =>
              setCustomer((prev: any) => ({
                ...prev,
                ...(data.customer || {}),
                medical_certificate_url: data.url,
                medical_certificate_start_date: data.startDate,
                medical_certificate_end_date: data.endDate,
                medical_certificate_status: data.status,
                medical_certificate_start: data.startDate,
                medical_certificate_end: data.endDate,
              }))
            }
          />
          <BGCard variant="premium">
            <BGSectionHeader
              title="Documenti cliente"
              subtitle="Certificato medico, date e contratto se presente."
            />
            <div className="info-grid">
              <InfoMini
                label="Certificato"
                value={
                  customer.medical_certificate_url ? "Caricato" : "Non caricato"
                }
                tone={customer.medical_certificate_url ? "success" : "danger"}
              />
              <InfoMini
                label="Inizio certificato"
                value={
                  customer.medical_certificate_start_date ||
                  customer.medical_certificate_start ||
                  "-"
                }
              />
              <InfoMini
                label="Scadenza certificato"
                value={medicalCertificateEnd || "-"}
                tone={certificateValid ? "success" : "danger"}
              />
              <InfoMini
                label="Contratto"
                value={contractUrl ? "Disponibile" : "Non presente"}
                tone={contractUrl ? "success" : "neutral"}
              />
            </div>
            {contractUrl ? (
              <BGButton href={contractUrl} variant="secondary">
                Apri contratto
              </BGButton>
            ) : (
              <BGEmptyState
                title="Nessun contratto collegato"
                description="Se il record cliente contiene un link contratto verrà mostrato qui."
              />
            )}
          </BGCard>
        </section>
      ) : null}

      {activeSection === "timeline" ? (
        <section className="section-panel">
          <BGCard variant="premium">
            <BGSectionHeader
              title="Note interne"
              subtitle="Aggiunta note e storico completo in card premium."
            />
            <div className="actions">
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Scrivi una nota interna..."
              />
              <BGButton variant="secondary" onClick={addNote}>
                Aggiungi
              </BGButton>
            </div>
            {notes.length === 0 ? (
              <BGEmptyState title="Nessuna nota interna" />
            ) : (
              notes.map((note) => (
                <div className="row" key={note.id}>
                  <div>
                    <div className="row-title">{note.note}</div>
                    <div className="row-subtitle">
                      {new Date(note.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
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
      <div className={`status-value ${ok ? "success-text" : "danger-text"}`}>
        {value}
      </div>
    </div>
  );
}

function OverviewCard({
  eyebrow,
  title,
  value,
  note,
  status,
  tone,
  action,
  onAction,
  children,
}: {
  eyebrow?: string;
  title: string;
  value: string;
  note: string;
  status: string;
  tone: StatusTone;
  action: string;
  onAction: () => void;
  children?: ReactNode;
}) {
  return (
    <article className={`mini-card mini-card-${tone}`}>
      <div className="mini-card-head">
        <div className="mini-card-title-stack">
          {eyebrow ? <div className="mini-card-eyebrow">{eyebrow}</div> : null}
          <div className="mini-title">{title}</div>
        </div>
        <BGStatusBadge tone={tone}>{status}</BGStatusBadge>
      </div>
      <div className="mini-card-copy">
        <div className="mini-value">{value}</div>
        <div className="small-muted">{note}</div>
        {children}
      </div>
      <div className="mini-card-action">
        <BGButton variant="ghost" onClick={onAction}>
          {action}
        </BGButton>
      </div>
    </article>
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
      <div
        className={`info-value ${tone === "success" ? "success-text" : tone === "danger" ? "danger-text" : ""}`}
      >
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
  onEdit,
  onCancel,
}: {
  subscription: any;
  today: string;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const amount = Number(subscription.amount || 0);
  const startsAt = String(subscription.starts_at || "").slice(0, 10);
  const endsAt = String(subscription.ends_at || "").slice(0, 10);

  const isCancelled = subscription.is_active === false;
  const isFuture = !isCancelled && startsAt > today;
  const isActive = !isCancelled && startsAt <= today && endsAt >= today;

  const statusLabel = isCancelled
    ? "Annullato"
    : isActive
      ? "Attivo"
      : isFuture
        ? "Pianificato"
        : "Storico";

  const statusTone = isCancelled
    ? "danger"
    : isActive
      ? "success"
      : isFuture
        ? "info"
        : "neutral";

  return (
    <div className="history-row">
      <div className="history-main">
        <div className="history-title">
          {subscription.subscription_plans?.name || "Abbonamento"}
        </div>
        <div className="history-period">
          Periodo: {startsAt || "—"} → {endsAt || "—"}
        </div>
        {subscription.payment_method ? (
          <div className="history-period">
            Metodo: {subscription.payment_method}
          </div>
        ) : null}
        {subscription.notes ? (
          <div className="history-period">
            Note: {String(subscription.notes).slice(0, 180)}
          </div>
        ) : null}
      </div>

      <div className="history-side">
        <div className="history-amount">€ {amount.toFixed(2)}</div>
        <BGStatusBadge tone={statusTone}>{statusLabel}</BGStatusBadge>

        <div className="actions" style={{ justifyContent: "flex-end" }}>
          <BGButton variant="secondary" onClick={onEdit}>
            Modifica
          </BGButton>
          {!isCancelled ? (
            <BGButton variant="danger" onClick={onCancel}>
              Annulla
            </BGButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MembershipFeeHistoryRow({ fee, today }: { fee: any; today: string }) {
  const amount = Number(fee.amount || 0);
  const isValid = fee.valid_from <= today && fee.valid_until >= today;

  return (
    <div className="history-row">
      <div className="history-main">
        <div className="history-title">Quota associativa</div>
        <div className="history-period">
          Validità: {fee.valid_from || "—"} → {fee.valid_until || "—"}
        </div>
      </div>
      <div className="history-side">
        <div className="history-amount">€ {amount.toFixed(2)}</div>
        {fee.payment_method ? (
          <div className="history-method">Metodo: {fee.payment_method}</div>
        ) : null}
        <BGStatusBadge tone={isValid ? "success" : "neutral"}>
          {isValid ? "Valida" : "Storico"}
        </BGStatusBadge>
      </div>
    </div>
  );
}
