"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { supabase } from "../../lib/supabaseClient";
import CustomerPhotoUpload from "../components/CustomerPhotoUpload";
import MedicalCertificateCard from "../components/MedicalCertificateCard";
import CustomerTimeline from "../components/CustomerTimeline";
import CustomerPaymentsHistory from "../components/CustomerPaymentsHistory";

type Customer = any;
type Plan = any;

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

  const [selectedPlanId, setSelectedPlanId] = useState("");
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
      setQrDataUrl("");
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


  async function getCashPaymentMethodId() {
    const { data } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("method_key", "cash")
      .maybeSingle();

    return data?.id || null;
  }

  async function renewMembershipFee() {
    if (!customer?.branch_id) return alert("Cliente senza sede.");

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 365);

    const membershipAmount = 10;
    const paymentMethodId = await getCashPaymentMethodId();

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        customer_id: customerId,
        payment_method_id: paymentMethodId,
        amount: membershipAmount,
        payment_type: "membership_fee",
        description: "Quota associativa annuale",
        status: "paid",
        paid_at: new Date().toISOString(),
        created_by: "admin@bodygate.it",
      })
      .select("id")
      .single();

    if (paymentError) {
      alert("Errore registrazione pagamento quota associativa.");
      return;
    }

    await supabase.from("cash_movements").insert({
      movement_type: "income",
      amount: membershipAmount,
      category: "membership_fee",
      description: "Incasso quota associativa",
      payment_id: payment?.id || null,
      created_by: "admin@bodygate.it",
      movement_at: new Date().toISOString(),
    });

    await supabase.from("customer_membership_fees").insert({
      customer_id: customerId,
      branch_id: customer.branch_id,
      amount: membershipAmount,
      valid_from: today,
      valid_until: validUntil.toISOString().slice(0, 10),
      payment_method: "cash",
    });

    await supabase.from("audit_logs").insert({
      staff_email: "admin@bodygate.it",
      staff_name: "Admin BodyGate",
      action: "membership_fee_renewed",
      entity_type: "customer",
      entity_id: customerId,
      details: {
        customer_name: customerName,
        amount: membershipAmount,
        valid_until: validUntil.toISOString().slice(0, 10),
      },
    });

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "membership",
      title: "Quota associativa rinnovata",
      description: `Quota €${membershipAmount} valida fino al ${validUntil
        .toISOString()
        .slice(0, 10)}`,
    });

    await loadAll();
    alert("Quota associativa rinnovata e pagamento registrato.");
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
        `Durata: ${Number(plan.duration_days || 0)} giorni\n\n` +
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
          payment_method: "cash",
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        console.error("renew-subscription error", json);
        alert(json?.error || "Errore rinnovo abbonamento.");
        return;
      }

      alert(
        `Rinnovo completato.\n\n` +
          `Cliente: ${json.customer_name || ""}\n` +
          `Piano: ${json.plan?.name || plan.name}\n` +
          `Ricevuta: ${json.receipt?.receipt_number || "creata"}`
      );

      await loadAll();

      if (json.print_url) {
        window.open(json.print_url, "_blank");
      }
    } catch (error) {
      console.error("renewSubscription failed", error);
      alert("Errore imprevisto durante il rinnovo abbonamento.");
    }
  }

  

  async function addNote() {
    if (!newNote.trim()) return;

    await supabase.from("customer_internal_notes").insert({
      customer_id: customerId,
      note: newNote.trim(),
      created_by: "Operatore",
    });

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "note",
      title: "Nota interna aggiunta",
      description: newNote.trim(),
    });

    setNewNote("");
    await loadAll();
  }

  async function addBlock() {
    if (!blockReason.trim()) return;

    await supabase.from("customer_blocks").insert({
      customer_id: customerId,
      reason: blockReason.trim(),
      block_type: "manual",
      is_active: true,
      created_by: "Operatore",
    });

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "block",
      title: "Cliente bloccato",
      description: blockReason.trim(),
    });

    setBlockReason("");
    await loadAll();
  }

  async function disableBlock(blockId: string) {
    await supabase
      .from("customer_blocks")
      .update({
        is_active: false,
        ends_at: new Date().toISOString(),
      })
      .eq("id", blockId);

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "block",
      title: "Blocco cliente disattivato",
      description: "Cliente sbloccato manualmente",
    });

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
      <div className="customer-page">
        <div className="loading-card">Caricamento cliente...</div>
      </div>
    );
  }

  if (errorMessage || !customer) {
    return (
      <div className="customer-page">
        <div className="error-card">
          <h2>Cliente non caricato</h2>
          <pre className="error-details">{errorMessage}</pre>
          <small>ID: {customerId}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-page">
      <style jsx>{`
        .customer-page {
          padding: 32px;
          color: #ffffff;
          background: #050505;
          min-height: 100vh;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 22px;
          gap: 16px;
        }

        .back-link {
          color: #a3a3a3;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
        }

        .back-link:hover {
          color: #ffffff;
        }

        .hero-layout {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 22px;
          margin-bottom: 24px;
        }

        .side-stack {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .hero {
          background: linear-gradient(135deg, #141414, #090909);
          border: 1px solid #262626;
          border-radius: 26px;
          padding: 28px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
        }

        .hero-top {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
        }

        .profile-area {
          display: flex;
          gap: 22px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .avatar {
          width: 92px;
          height: 92px;
          border-radius: 24px;
          object-fit: cover;
          border: 2px solid #262626;
          flex-shrink: 0;
        }

        .avatar-placeholder {
          width: 92px;
          height: 92px;
          border-radius: 24px;
          background: linear-gradient(135deg, #ef4444, #7f1d1d);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 900;
          flex-shrink: 0;
        }

        h1 {
          font-size: 32px;
          margin: 0;
          font-weight: 900;
          letter-spacing: -0.5px;
        }

        h2 {
          font-size: 20px;
          margin: 0 0 18px;
          font-weight: 900;
        }

        .muted {
          color: #a3a3a3;
          margin-top: 8px;
          font-size: 14px;
        }

        .customer-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(180px, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .info-mini-card {
          background: #101010;
          border: 1px solid #262626;
          border-radius: 16px;
          padding: 12px 14px;
        }

        .info-label {
          color: #737373;
          font-size: 11px;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 14px;
          font-weight: 800;
          word-break: break-word;
        }

        .badge-status {
          padding: 13px 18px;
          border-radius: 999px;
          font-weight: 900;
          font-size: 13px;
          white-space: nowrap;
        }

        .ok {
          background: rgba(34, 197, 94, 0.14);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.35);
        }

        .ko {
          background: rgba(239, 68, 68, 0.14);
          color: #fb7185;
          border: 1px solid rgba(239, 68, 68, 0.35);
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-top: 28px;
        }

        .status-box,
        .card,
        .error-card,
        .loading-card {
          background: #101010;
          border: 1px solid #262626;
          border-radius: 22px;
          padding: 22px;
        }

        .error-details {
          white-space: pre-wrap;
          word-break: break-word;
          color: #fca5a5;
          background: #050505;
          border: 1px solid #262626;
          border-radius: 14px;
          padding: 14px;
          font-size: 13px;
          line-height: 1.5;
        }

        .status-label {
          color: #a3a3a3;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .status-value {
          font-size: 15px;
          font-weight: 800;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 22px;
          margin-bottom: 22px;
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 14px;
        }

        button,
        select,
        input {
          border-radius: 14px;
          border: 1px solid #303030;
          padding: 13px 15px;
          font-size: 14px;
          outline: none;
        }

        input,
        select {
          background: #050505;
          color: #fff;
          width: 100%;
        }

        button {
          background: #ef4444;
          color: white;
          border: none;
          font-weight: 900;
          cursor: pointer;
          transition: 0.2s;
        }

        button:hover {
          transform: translateY(-1px);
          opacity: 0.92;
        }

        .secondary-btn {
          background: #ffffff;
          color: #000000;
        }

        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid #262626;
          background: #080808;
          border-radius: 16px;
          padding: 14px;
          margin-top: 10px;
          gap: 14px;
        }

        .row-title {
          font-weight: 900;
        }

        .row-subtitle,
        .row-right {
          color: #a3a3a3;
          font-size: 13px;
          margin-top: 4px;
        }

        .empty {
          color: #737373;
          font-size: 14px;
          padding: 12px 0;
        }


        .credentials-card {
          border: 1px solid rgba(239, 68, 68, 0.35);
          background: linear-gradient(180deg, #141414, #090909);
        }

        .credential-summary {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .credential-mini {
          background: #050505;
          border: 1px solid #262626;
          border-radius: 14px;
          padding: 12px;
        }

        .credential-mini-label {
          color: #737373;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 5px;
        }

        .credential-mini-value {
          font-weight: 900;
          font-size: 14px;
        }

        .credential-section {
          border-top: 1px solid #262626;
          padding-top: 14px;
          margin-top: 14px;
        }

        .credential-section-title {
          font-size: 13px;
          color: #a3a3a3;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 10px;
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

        .qr-box {
          background: #ffffff;
          border-radius: 18px;
          padding: 14px;
          display: inline-flex;
          margin: 6px 0 12px;
        }

        .qr-box img {
          width: 210px;
          height: 210px;
          display: block;
        }

        .qr-meta {
          color: #a3a3a3;
          font-size: 13px;
          line-height: 1.7;
          word-break: break-word;
        }

        .danger-text {
          color: #fb7185;
        }

        .success-text {
          color: #4ade80;
        }


        .mobile-pass-section {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 18px;
          margin-top: 18px;
        }

        .mobile-pass-url {
          border: 1px solid rgba(59, 130, 246, 0.22);
          background: rgba(59, 130, 246, 0.08);
          color: #bfdbfe;
          border-radius: 14px;
          padding: 12px;
          font-size: 12px;
          line-height: 1.45;
          word-break: break-all;
          margin: 12px 0;
        }


        .hero-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .edit-panel {
          margin-top: 22px;
          border: 1px solid rgba(239, 68, 68, 0.32);
          background: rgba(239, 68, 68, 0.055);
          border-radius: 22px;
          padding: 18px;
        }

        .edit-panel-header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          margin-bottom: 16px;
        }

        .edit-panel-title {
          font-size: 18px;
          font-weight: 950;
        }

        .edit-form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .edit-field {
          display: grid;
          gap: 7px;
        }

        .edit-field label {
          color: #a3a3a3;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          font-weight: 900;
        }

        textarea {
          border-radius: 14px;
          border: 1px solid #303030;
          padding: 13px 15px;
          font-size: 14px;
          outline: none;
          background: #050505;
          color: #fff;
          width: 100%;
          min-height: 92px;
          resize: vertical;
          font-family: inherit;
        }

        .edit-field-full {
          grid-column: 1 / -1;
        }

        .checkbox-field {
          border: 1px solid #303030;
          border-radius: 14px;
          padding: 13px 15px;
          background: #050505;
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 47px;
        }

        .checkbox-field input {
          width: auto;
          accent-color: #ef4444;
        }

        .checkbox-field span {
          font-weight: 900;
          color: #ffffff;
        }

        @media (max-width: 1100px) {
          .hero-layout,
          .status-grid,
          .grid,
          .customer-info-grid {
            grid-template-columns: 1fr;
          }

          .hero-top,
          .actions,
          .topbar {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}
      </style>

      <div className="topbar">
        <a className="back-link" href="/customers">
          ← Torna ai clienti
        </a>
      </div>

      <div className="hero-layout">
        <div className="hero">
          <div className="hero-top">
            <div className="profile-area">
              {customer?.photo_url ? (
                <img className="avatar" src={customer.photo_url} alt={customerName} />
              ) : (
                <div className="avatar-placeholder">{initials}</div>
              )}

              <div>
                <h1>{customerName}</h1>

                <p className="muted">
                  Badge: {customer.badge_code || "-"} · Controller:{" "}
                  {customer.controller_code || "-"}
                </p>

                <div className="customer-info-grid">
                  {customerInfo.map((item) => (
                    <div className="info-mini-card" key={item.label}>
                      <div className="info-label">{item.label}</div>
                      <div className="info-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hero-actions">
              <div className={`badge-status ${accessAllowed ? "ok" : "ko"}`}>
                {accessAllowed ? "ACCESSO ATTIVO" : "ACCESSO BLOCCATO"}
              </div>

              {!isEditingCustomer ? (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={startEditCustomer}
                >
                  Modifica anagrafica
                </button>
              ) : null}
            </div>
          </div>

          {isEditingCustomer ? (
            <div className="edit-panel">
              <div className="edit-panel-header">
                <div>
                  <div className="edit-panel-title">Modifica anagrafica professionale</div>
                  <div className="muted">
                    Aggiorna i dati cliente, credenziali principali e stato attività.
                  </div>
                </div>

                <div className="actions" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={cancelEditCustomer}
                    disabled={savingCustomer}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={saveCustomerProfile}
                    disabled={savingCustomer}
                  >
                    {savingCustomer ? "Salvataggio..." : "Salva"}
                  </button>
                </div>
              </div>

              <div className="edit-form-grid">
                <div className="edit-field">
                  <label>Nome</label>
                  <input
                    value={editForm.first_name || ""}
                    onChange={(e) => updateEditField("first_name", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>Cognome</label>
                  <input
                    value={editForm.last_name || ""}
                    onChange={(e) => updateEditField("last_name", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>Telefono</label>
                  <input
                    value={editForm.phone || ""}
                    onChange={(e) => updateEditField("phone", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => updateEditField("email", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>Codice fiscale</label>
                  <input
                    value={editForm.fiscal_code || ""}
                    onChange={(e) => updateEditField("fiscal_code", e.target.value.toUpperCase())}
                  />
                </div>

                <div className="edit-field">
                  <label>Data nascita</label>
                  <input
                    type="date"
                    value={editForm.birth_date || ""}
                    onChange={(e) => updateEditField("birth_date", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>Sesso</label>
                  <select
                    value={editForm.gender || ""}
                    onChange={(e) => updateEditField("gender", e.target.value)}
                  >
                    <option value="">Non specificato</option>
                    <option value="M">Maschile</option>
                    <option value="F">Femminile</option>
                    <option value="ALTRO">Altro</option>
                  </select>
                </div>

                <div className="edit-field">
                  <label>Indirizzo</label>
                  <input
                    value={editForm.address || ""}
                    onChange={(e) => updateEditField("address", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>Città</label>
                  <input
                    value={editForm.city || ""}
                    onChange={(e) => updateEditField("city", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>CAP</label>
                  <input
                    value={editForm.postal_code || ""}
                    onChange={(e) => updateEditField("postal_code", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>Contatto emergenza</label>
                  <input
                    value={editForm.emergency_contact_name || ""}
                    onChange={(e) => updateEditField("emergency_contact_name", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>Telefono emergenza</label>
                  <input
                    value={editForm.emergency_contact_phone || ""}
                    onChange={(e) => updateEditField("emergency_contact_phone", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>Badge principale</label>
                  <input
                    value={editForm.badge_code || ""}
                    onChange={(e) => updateEditField("badge_code", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>Controller code</label>
                  <input
                    value={editForm.controller_code || ""}
                    onChange={(e) => updateEditField("controller_code", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label>Stato cliente</label>
                  <div className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={!!editForm.is_active}
                      onChange={(e) => updateEditField("is_active", e.target.checked)}
                    />
                    <span>{editForm.is_active ? "Cliente attivo" : "Cliente disattivato"}</span>
                  </div>
                </div>

                <div className="edit-field edit-field-full">
                  <label>Note reception</label>
                  <textarea
                    value={editForm.reception_notes || ""}
                    onChange={(e) => updateEditField("reception_notes", e.target.value)}
                    placeholder="Note interne rapide visibili alla reception..."
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="status-grid">
            <StatusBox
              label="Quota associativa"
              value={
                activeMembership
                  ? `Valida fino al ${activeMembership.valid_until}`
                  : "Assente o scaduta"
              }
              ok={!!activeMembership}
            />

            <StatusBox
              label="Abbonamento"
              value={
                activeSubscription
                  ? `${activeSubscription.subscription_plans?.name || "Attivo"} fino al ${activeSubscription.ends_at}`
                  : "Assente o scaduto"
              }
              ok={!!activeSubscription}
            />

            <StatusBox
              label="Certificato medico"
              value={
                certificateValid
                  ? `Valido fino al ${medicalCertificateEnd}`
                  : "Scaduto o mancante"
              }
              ok={!!certificateValid}
            />

            <StatusBox
              label="Blocchi"
              value={activeBlock ? activeBlock.reason : "Nessun blocco"}
              ok={!activeBlock}
            />
          </div>
        </div>

        <div className="side-stack">
          <CustomerPhotoUpload
            customerId={customer.id}
            currentPhotoUrl={customer.photo_url}
            onUploaded={(url) => {
              setCustomer((prev: any) => ({
                ...prev,
                photo_url: url,
              }));
            }}
          />

          <MedicalCertificateCard
            customerId={customer.id}
            currentCertificateUrl={customer.medical_certificate_url}
            startDate={customer.medical_certificate_start_date}
            endDate={customer.medical_certificate_end_date}
            onUpdated={(data) => {
              setCustomer((prev: any) => ({
                ...prev,
                medical_certificate_url: data.url,
                medical_certificate_start_date: data.startDate,
                medical_certificate_end_date: data.endDate,
              }));
            }}
          />

          <div className="card credentials-card">
            <h2>Credenziali accesso</h2>

            <div className="credential-summary">
              <div className="credential-mini">
                <div className="credential-mini-label">RFID / NFC</div>
                <div className="credential-mini-value">
                  {cardCredentials.length} attive
                </div>
              </div>

              <div className="credential-mini">
                <div className="credential-mini-label">QR DNake</div>
                <div
                  className={`credential-mini-value ${
                    activeDnakeQr ? "success-text" : "danger-text"
                  }`}
                >
                  {activeDnakeQr ? "Attivo" : "Non generato"}
                </div>
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
                    <div className="qr-box">
                      <img src={qrDataUrl} alt="QR DNake" />
                    </div>
                  ) : (
                    <p className="empty">Generazione immagine QR...</p>
                  )}

                  <div className="qr-meta">
                    <div>
                      <strong>ID DNake:</strong> {activeDnakeQr.dnake_user_id}
                    </div>
                    <div>
                      <strong>Nome DNake:</strong> {activeDnakeQr.dnake_name}
                    </div>
                    <div>
                      <strong>Stato:</strong> {activeDnakeQr.qr_status}
                    </div>
                  </div>

                  <div className="actions">
                    <button
                      className="secondary-btn"
                      type="button"
                      onClick={printQr}
                      disabled={!qrDataUrl}
                    >
                      Visualizza / stampa
                    </button>

                    <button
                      type="button"
                      onClick={generateDnakeQr}
                      disabled={qrGenerating}
                    >
                      {qrGenerating ? "Rigenero..." : "Rigenera QR"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="empty">
                    Nessun QR DNake generato per questo cliente.
                  </p>

                  <button
                    type="button"
                    onClick={generateDnakeQr}
                    disabled={qrGenerating}
                  >
                    {qrGenerating ? "Generazione..." : "Genera QR DNake"}
                  </button>
                </>
              )}

              {qrCredentials.length > 0 && (
                <div className="qr-meta" style={{ marginTop: 12 }}>
                  Credenziali QR salvate: {qrCredentials.length}
                </div>
              )}
            </div>

            <div className="credential-section mobile-pass-section">
              <div className="credential-section-title">App cliente / WhatsApp</div>

              <p className="empty">
                Crea il link personale del cliente e invialo su WhatsApp. Il cliente potrà aprire il QR dal telefono.
              </p>

              {mobilePassUrl ? (
                <div className="mobile-pass-url">
                  {mobilePassUrl}
                </div>
              ) : null}

              <div className="actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={createOrGetMobilePass}
                  disabled={mobilePassLoading}
                >
                  {mobilePassLoading ? "Creo link..." : "Genera Pass Mobile"}
                </button>

                <button
                  type="button"
                  onClick={sendMobilePassWhatsApp}
                  disabled={mobilePassLoading}
                >
                  Invia su WhatsApp
                </button>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={copyMobilePassLink}
                  disabled={mobilePassLoading}
                >
                  Copia link
                </button>
              </div>

              {!customer?.phone ? (
                <div className="qr-meta danger-text" style={{ marginTop: 10 }}>
                  Telefono cliente mancante: WhatsApp si aprirà senza destinatario.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Rinnovo rapido + pagamento</h2>

          <button onClick={renewMembershipFee}>
            Rinnova quota associativa 10€
          </button>

          <div className="quick-plan-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
            {plans.length === 0 && (
              <div className="empty">Nessun piano attivo configurato.</div>
            )}

            {plans.map((plan) => {
              const price = Number(plan.promo_price || plan.price || 0);
              const duration = Number(plan.duration_days || 0);

              return (
                <button
                  key={plan.id}
                  type="button"
                  className="quick-plan-btn"
                  style={{ border: "1px solid rgba(255,255,255,0.12)", background: "linear-gradient(180deg, rgba(239,68,68,0.18), rgba(255,255,255,0.055))", color: "white", borderRadius: 18, padding: 16, display: "grid", gap: 7, textAlign: "left", cursor: "pointer", minHeight: 112 }}
                  onClick={() => renewSubscription(plan.id)}
                >
                  <span style={{ fontSize: 17, fontWeight: 950 }}>{plan.name}</span>
                  <strong style={{ fontSize: 25, fontWeight: 950 }}>€ {price.toFixed(2)}</strong>
                  <small style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700 }}>{duration} giorni · da oggi</small>
                </button>
              );
            })}
          </div>

          <div className="manual-renew-box" style={{ marginTop: 16, padding: 14, borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.035)" }}>
            <div className="small-muted" style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700 }}>Rinnovo manuale / piano personalizzato</div>
            <div className="actions">
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
              >
                <option value="">Seleziona piano</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - €{Number(plan.promo_price || plan.price || 0).toFixed(2)} -{" "}
                    {plan.duration_days} giorni
                  </option>
                ))}
              </select>

              <button className="secondary-btn" onClick={() => renewSubscription()}>
                Rinnova
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Blocco rapido cliente</h2>

          <div className="actions">
            <input
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Motivo blocco..."
            />

            <button onClick={addBlock}>Blocca</button>
          </div>

          {blocks.length === 0 && <p className="empty">Nessun blocco presente.</p>}

          {blocks.map((block) => (
            <div className="row" key={block.id}>
              <div>
                <div className="row-title">{block.reason}</div>
                <div className="row-subtitle">
                  Stato: {block.is_active ? "Attivo" : "Disattivato"}
                </div>
              </div>

              {block.is_active && (
                <button className="secondary-btn" onClick={() => disableBlock(block.id)}>
                  Sblocca
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid">
        <HistoryCard title="Storico abbonamenti">
          {subscriptions.length === 0 && <p className="empty">Nessun abbonamento.</p>}

          {subscriptions.map((sub) => (
            <InfoRow
              key={sub.id}
              title={sub.subscription_plans?.name || "Abbonamento"}
              subtitle={`${sub.starts_at} → ${sub.ends_at}`}
              right={`€ ${sub.amount}`}
            />
          ))}
        </HistoryCard>

        <HistoryCard title="Storico quota associativa">
          {membershipFees.length === 0 && (
            <p className="empty">Nessuna quota registrata.</p>
          )}

          {membershipFees.map((fee) => (
            <InfoRow
              key={fee.id}
              title={`Quota € ${fee.amount}`}
              subtitle={`${fee.valid_from} → ${fee.valid_until}`}
              right={fee.payment_method || ""}
            />
          ))}
        </HistoryCard>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Note interne</h2>

          <div className="actions">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Scrivi una nota interna..."
            />

            <button className="secondary-btn" onClick={addNote}>
              Aggiungi
            </button>
          </div>

          {notes.length === 0 && <p className="empty">Nessuna nota interna.</p>}

          {notes.map((note) => (
            <div className="row" key={note.id}>
              <div>
                <div className="row-title">{note.note}</div>
                <div className="row-subtitle">
                  {new Date(note.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        <HistoryCard title="Ultimi accessi">
          {accessLogs.length === 0 && <p className="empty">Nessun accesso registrato.</p>}

          {accessLogs.map((log) => (
            <InfoRow
              key={log.id}
              title={log.was_allowed ? "Accesso consentito" : "Accesso negato"}
              subtitle={new Date(log.access_time).toLocaleString()}
              right={log.reason}
            />
          ))}
        </HistoryCard>
      </div>

      <CustomerPaymentsHistory customerId={customer.id} />

      <CustomerTimeline customerId={customer.id} />
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
      <div className={`status-value ${ok ? "ok-text" : "ko-text"}`}>{value}</div>

      <style jsx>{`
        .ok-text {
          color: #4ade80;
        }

        .ko-text {
          color: #fb7185;
        }
      `}
      </style>
    </div>
  );
}

function HistoryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <h2>{title}</h2>
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
      <div>
        <div className="row-title">{title}</div>
        <div className="row-subtitle">{subtitle}</div>
      </div>

      {right && <div className="row-right">{right}</div>}
    </div>
  );
}