"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabaseClient";
import CustomerPhotoUpload from "../components/CustomerPhotoUpload";
import MedicalCertificateCard from "../components/MedicalCertificateCard";
import CustomerTimeline from "../components/CustomerTimeline";
import CustomerPaymentsHistory from "../components/CustomerPaymentsHistory";

type Customer = any;
type Plan = any;

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
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [newNote, setNewNote] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const customerName =
    `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() ||
    "Cliente senza nome";

  const initials =
    `${customer?.first_name?.[0] || ""}${customer?.last_name?.[0] || ""}`.toUpperCase() ||
    "BG";

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
        setErrorMessage("Cliente non trovato o errore nel caricamento.");
        setCustomer(null);
        return;
      }

      setCustomer(customerData);

      if (customerData.branch_id) {
        const { data: plansData } = await supabase
          .from("subscription_plans")
          .select("*")
          .eq("branch_id", customerData.branch_id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        setPlans(plansData || []);
      }

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
  ];

  async function renewMembershipFee() {
    if (!customer?.branch_id) return alert("Cliente senza sede.");

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 365);

    await supabase.from("customer_membership_fees").insert({
      customer_id: customerId,
      branch_id: customer.branch_id,
      amount: 10,
      valid_from: today,
      valid_until: validUntil.toISOString().slice(0, 10),
      payment_method: "cash",
    });

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "membership",
      title: "Quota associativa rinnovata",
      description: `Quota €10 valida fino al ${validUntil.toISOString().slice(0, 10)}`,
    });

    await loadAll();
    alert("Quota associativa rinnovata.");
  }

  async function renewSubscription() {
    if (!customer?.branch_id) return alert("Cliente senza sede.");
    if (!selectedPlanId) return alert("Seleziona un abbonamento.");

    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return alert("Piano non trovato.");

    const end = new Date();
    end.setDate(end.getDate() + Number(plan.duration_days));

    await supabase.from("customer_subscriptions").insert({
      customer_id: customerId,
      branch_id: customer.branch_id,
      plan_id: plan.id,
      amount: plan.price,
      starts_at: today,
      ends_at: end.toISOString().slice(0, 10),
      is_active: true,
      payment_method: "cash",
    });

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "subscription",
      title: "Abbonamento rinnovato",
      description: `${plan.name} - €${plan.price} - valido fino al ${end
        .toISOString()
        .slice(0, 10)}`,
    });

    await loadAll();
    alert("Abbonamento rinnovato.");
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
          <p>{errorMessage}</p>
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
      `}</style>

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

            <div className={`badge-status ${accessAllowed ? "ok" : "ko"}`}>
              {accessAllowed ? "ACCESSO ATTIVO" : "ACCESSO BLOCCATO"}
            </div>
          </div>

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
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Rinnovo rapido</h2>

          <button onClick={renewMembershipFee}>
            Rinnova quota associativa 10€
          </button>

          <div className="actions">
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
            >
              <option value="">Seleziona abbonamento</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - €{plan.price} - {plan.duration_days} giorni
                </option>
              ))}
            </select>

            <button className="secondary-btn" onClick={renewSubscription}>
              Rinnova
            </button>
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

          {blocks.length === 0 && (
            <p className="empty">Nessun blocco presente.</p>
          )}

          {blocks.map((block) => (
            <div className="row" key={block.id}>
              <div>
                <div className="row-title">{block.reason}</div>
                <div className="row-subtitle">
                  Stato: {block.is_active ? "Attivo" : "Disattivato"}
                </div>
              </div>

              {block.is_active && (
                <button
                  className="secondary-btn"
                  onClick={() => disableBlock(block.id)}
                >
                  Sblocca
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid">
        <HistoryCard title="Storico abbonamenti">
          {subscriptions.length === 0 && (
            <p className="empty">Nessun abbonamento.</p>
          )}

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

          {notes.length === 0 && (
            <p className="empty">Nessuna nota interna.</p>
          )}

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
          {accessLogs.length === 0 && (
            <p className="empty">Nessun accesso registrato.</p>
          )}

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
      <div className={`status-value ${ok ? "ok-text" : "ko-text"}`}>
        {value}
      </div>

      <style jsx>{`
        .ok-text {
          color: #4ade80;
        }

        .ko-text {
          color: #fb7185;
        }
      `}</style>
    </div>
  );
}

function HistoryCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
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