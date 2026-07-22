"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BGButton from "@/components/bodygate-ui/BGButton";
import BGEmptyState from "@/components/bodygate-ui/BGEmptyState";
import BGInput from "@/components/bodygate-ui/BGInput";
import BGStatusBadge from "@/components/bodygate-ui/BGStatusBadge";

type Customer = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email: string | null;
  phone: string | null;
  badge_code: string | null;
  controller_code?: string | null;
  access_activation_status?: string | null;
  medical_certificate_status?: string | null;
  medical_certificate_end_date?: string | null;
  subscription_status: string | null;
  subscription_expiry: string | null;
  active: boolean;
  created_at: string;
};

type Tone = "green" | "red" | "yellow" | "blue" | "neutral";

type ListFilter =
  | "active"
  | "all"
  | "inactive"
  | "to_check"
  | "with_badge"
  | "without_badge";

type CustomerListStats = {
  total_customers: number;
  total_records: number;
  inactive_customers: number;
  access_active: number;
  to_check: number;
  expiring_soon: number;
  with_badge: number;
  without_badge: number;
};

const LIST_FILTERS: Array<{ value: ListFilter; label: string }> = [
  { value: "active", label: "Attivi" },
  { value: "all", label: "Tutti" },
  { value: "inactive", label: "Inattivi" },
  { value: "to_check", label: "Da verificare" },
  { value: "with_badge", label: "Con badge" },
  { value: "without_badge", label: "Senza badge" },
];

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

function normalize(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function getName(customer: Customer) {
  const full = customer.full_name?.trim();
  const composed =
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
  return full || composed || "Cliente senza nome";
}

function getBadgeCode(customer: Customer) {
  return String(customer.badge_code || customer.controller_code || "").trim();
}

function formatSubscriptionStatus(value: string | null, active: boolean) {
  const status = normalize(value);

  if (status === "active" || status === "attivo") return "Attivo";
  if (status === "expired" || status === "scaduto") return "Scaduto";
  if (status === "paused" || status === "suspended") return "Sospeso";
  if (status === "cancelled" || status === "canceled") return "Annullato";
  if (status === "none" || !status) return active ? "Attivo" : "Non attivo";

  return value || (active ? "Attivo" : "Non attivo");
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean).slice(0, 2);
  return parts.length ? parts.map((p) => p[0]?.toUpperCase()).join("") : "BG";
}

function getAccessState(customer: Customer): {
  label: string;
  tone: Tone;
  hint: string;
} {
  const status = normalize(customer.subscription_status);
  const days = daysUntil(customer.subscription_expiry);

  if (!customer.active) {
    return { label: "Bloccato", tone: "red", hint: "Cliente non attivo" };
  }

  if (
    status.includes("expired") ||
    status.includes("scad") ||
    (days !== null && days < 0)
  ) {
    return { label: "Da verificare", tone: "red", hint: "Abbonamento scaduto" };
  }

  if (days !== null && days <= 7) {
    return {
      label: "In scadenza",
      tone: "yellow",
      hint: `Scade tra ${days} giorni`,
    };
  }

  return { label: "Accesso attivo", tone: "green", hint: "Cliente operativo" };
}

export default function CustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>("active");
  const [serverStats, setServerStats] = useState<CustomerListStats | null>(null);

  async function loadCustomers() {
    setLoading(true);
    setQueryError(null);

    try {
      const response = await fetch(`/api/customers/list?status=${listFilter}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok || !payload?.ok) {
        setCustomers([]);
        setServerStats(null);
        setQueryError(payload?.error || "Impossibile caricare i clienti.");
        return;
      }

      const list = (payload.customers || []) as Customer[];
      setCustomers(list);
      setServerStats(payload.stats || null);

      setSelectedId((current) => {
        if (current && list.some((customer) => customer.id === current)) {
          return current;
        }

        return list[0]?.id || null;
      });
    } catch (error) {
      setCustomers([]);
      setServerStats(null);
      setQueryError(
        error instanceof Error ? error.message : "Errore imprevisto.",
      );
    } finally {
      setLoadedOnce(true);
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadCustomers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listFilter]);

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return customers;

    return customers.filter((customer) => {
      const name = getName(customer).toLowerCase();

      return (
        name.includes(q) ||
        String(customer.phone || "")
          .toLowerCase()
          .includes(q) ||
        String(customer.email || "")
          .toLowerCase()
          .includes(q) ||
        getBadgeCode(customer).toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

  const selectedCustomer = useMemo(() => {
    return (
      filteredCustomers.find((customer) => customer.id === selectedId) ||
      filteredCustomers[0] ||
      customers.find((customer) => customer.id === selectedId) ||
      null
    );
  }, [customers, filteredCustomers, selectedId]);

  const metrics = useMemo(() => {
    if (serverStats) {
      return {
        total: serverStats.total_customers,
        active: serverStats.access_active,
        attention: serverStats.to_check,
        expiring: serverStats.expiring_soon,
        withBadge: serverStats.with_badge,
      };
    }

    let active = 0;
    let attention = 0;
    let expiring = 0;
    let withBadge = 0;

    customers.forEach((customer) => {
      const state = getAccessState(customer);

      if (state.tone === "green") active += 1;
      if (state.tone === "red") attention += 1;
      if (state.tone === "yellow") expiring += 1;
      if (getBadgeCode(customer)) withBadge += 1;
    });

    return {
      total: customers.length,
      active,
      attention,
      expiring,
      withBadge,
    };
  }, [customers, serverStats]);


  return (
    <section className="crm3-page">
      <style jsx>{`
        .crm3-page {
          color: #fff;
          min-width: 0;
        }

        .crm3-shell {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        .crm3-hero,
        .crm3-list-panel,
        .crm3-detail-panel {
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: linear-gradient(145deg, rgba(20, 20, 22, 0.98), rgba(7, 7, 8, 0.99));
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
        }

        .crm3-hero {
          border-radius: 12px;
          padding: 18px 20px 14px;
        }

        .crm3-hero-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 22px;
        }

        .crm3-eyebrow {
          margin-bottom: 5px;
          color: #ef4444;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .crm3-title {
          margin: 0;
          font-size: clamp(28px, 2.5vw, 38px);
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.035em;
        }

        .crm3-subtitle {
          margin-top: 7px;
          max-width: 650px;
          color: #9d9da5;
          font-size: 12px;
          line-height: 1.45;
        }

        .crm3-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
          flex: 0 0 auto;
        }

        .crm3-filters {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          margin-top: 13px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }

        .crm3-filter-btn {
          min-height: 30px;
          padding: 0 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.035);
          color: #a9a9b0;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
          transition: 150ms ease;
        }

        .crm3-filter-btn:hover {
          border-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .crm3-filter-btn-active {
          border-color: rgba(239, 68, 68, 0.48);
          background: rgba(239, 68, 68, 0.16);
          color: #fff;
          box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.08);
        }

        .crm3-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          min-width: 0;
        }

        .crm3-metric {
          position: relative;
          min-width: 0;
          min-height: 76px;
          padding: 13px 15px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          background: linear-gradient(145deg, rgba(20, 20, 22, 0.96), rgba(8, 8, 9, 0.98));
        }

        .crm3-metric::after {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: var(--metric, #71717a);
          box-shadow: 0 0 18px var(--metric, #71717a);
        }

        .crm3-metric-label {
          color: #8e8e96;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .crm3-metric-value {
          margin-top: 6px;
          font-size: 25px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .crm3-metric-blue { --metric: #3b82f6; }
        .crm3-metric-green { --metric: #22c55e; }
        .crm3-metric-red { --metric: #ef4444; }
        .crm3-metric-yellow { --metric: #eab308; }
        .crm3-metric-neutral { --metric: #71717a; }

        .crm3-workspace {
          display: grid;
          grid-template-columns: minmax(330px, 37%) minmax(0, 1fr);
          gap: 14px;
          min-width: 0;
          align-items: start;
        }

        .crm3-list-panel,
        .crm3-detail-panel {
          min-width: 0;
          border-radius: 12px;
          overflow: hidden;
        }

        .crm3-list-head {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          padding: 13px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        }

        :global(.crm3-search) {
          width: 100%;
          height: 38px !important;
          min-height: 38px !important;
          padding: 0 13px !important;
          border-radius: 8px !important;
          font-size: 12px !important;
          line-height: 38px !important;
        }

        .crm3-count {
          color: #777780;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .crm3-list {
          display: grid;
          gap: 3px;
          padding: 7px;
        }

        .crm3-list-item {
          width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) 10px;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: #fff;
          text-align: left;
          cursor: pointer;
        }

        .crm3-list-item:hover { background: rgba(255, 255, 255, 0.04); }

        .crm3-list-item-active {
          border-color: rgba(239, 68, 68, 0.3);
          background: linear-gradient(90deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05));
        }

        .crm3-avatar,
        .crm3-detail-avatar {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          color: #fff;
          font-weight: 900;
          background: linear-gradient(135deg, #ef4444, #7f1d1d);
          box-shadow: 0 8px 20px rgba(239, 68, 68, 0.18);
        }

        .crm3-avatar {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          font-size: 11px;
        }

        .crm3-list-name {
          min-width: 0;
          overflow: hidden;
          color: #f5f5f5;
          font-size: 13px;
          line-height: 1.2;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .crm3-list-sub {
          min-width: 0;
          margin-top: 4px;
          overflow: hidden;
          color: #777780;
          font-size: 11px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .crm3-mini-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--dot);
          box-shadow: 0 0 12px var(--dot);
        }

        .crm3-dot-green { --dot: #22c55e; }
        .crm3-dot-red { --dot: #ef4444; }
        .crm3-dot-yellow { --dot: #eab308; }
        .crm3-dot-blue,
        .crm3-dot-neutral { --dot: #71717a; }

        .crm3-detail {
          display: grid;
          gap: 13px;
          padding: 17px;
        }

        .crm3-detail-hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding-bottom: 13px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        }

        .crm3-detail-main {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .crm3-detail-avatar {
          width: 46px;
          height: 46px;
          border-radius: 11px;
          font-size: 15px;
        }

        .crm3-detail-name {
          min-width: 0;
          overflow: hidden;
          color: #fff;
          font-size: clamp(20px, 2vw, 27px);
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -0.03em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .crm3-detail-contact {
          min-width: 0;
          margin-top: 5px;
          overflow: hidden;
          color: #92929a;
          font-size: 12px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .crm3-detail-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .crm3-info {
          min-width: 0;
          min-height: 66px;
          padding: 11px 12px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.028);
        }

        .crm3-info span {
          display: block;
          color: #777780;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .crm3-info strong {
          display: block;
          min-width: 0;
          margin-top: 7px;
          overflow: hidden;
          color: #f4f4f5;
          font-size: 12px;
          line-height: 1.25;
          font-weight: 850;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .crm3-action-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }

        .crm3-action {
          min-width: 0;
          min-height: 70px;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) 18px;
          align-items: center;
          gap: 11px;
          padding: 11px 13px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.032);
          color: #fff;
          text-decoration: none;
          transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
        }

        .crm3-action:hover {
          transform: translateY(-1px);
          border-color: rgba(239, 68, 68, 0.45);
          background: rgba(239, 68, 68, 0.09);
        }

        .crm3-action-primary {
          border-color: rgba(239, 68, 68, 0.45);
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(153, 27, 27, 0.95));
          box-shadow: 0 12px 28px rgba(239, 68, 68, 0.18);
        }

        .crm3-action-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.055);
          font-size: 16px;
          font-weight: 900;
        }

        .crm3-action-copy {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .crm3-action strong {
          overflow: hidden;
          font-size: 12px;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .crm3-action-copy span {
          overflow: hidden;
          color: rgba(228, 228, 231, 0.68);
          font-size: 10px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .crm3-action-arrow {
          color: rgba(255, 255, 255, 0.48);
          font-size: 16px;
          text-align: right;
        }

        .crm3-message {
          padding: 16px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          color: #d4d4d8;
          font-weight: 800;
        }

        .crm3-message-error {
          border: 1px solid rgba(239, 68, 68, 0.28);
          background: rgba(239, 68, 68, 0.08);
          color: #fecaca;
        }

        @media (max-width: 1380px) {
          .crm3-workspace { grid-template-columns: minmax(300px, 34%) minmax(0, 1fr); }
          .crm3-list-head { grid-template-columns: 1fr; gap: 7px; }
          .crm3-count { white-space: normal; }
          .crm3-detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 1040px) {
          .crm3-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .crm3-workspace { grid-template-columns: 1fr; }
        }

        @media (max-width: 720px) {
          .crm3-hero-inner,
          .crm3-detail-hero { align-items: stretch; flex-direction: column; }
          .crm3-actions { justify-content: flex-start; }
          .crm3-metrics,
          .crm3-detail-grid,
          .crm3-action-grid { grid-template-columns: 1fr; }
          .crm3-detail-name,
          .crm3-detail-contact { white-space: normal; overflow-wrap: anywhere; }
        }
      `}</style>

      <div className="crm3-shell">
        <header className="crm3-hero">
          <div className="crm3-hero-inner">
            <div>
              <div className="crm3-eyebrow">CRM operativo fitness</div>
              <h2 className="crm3-title">Clienti</h2>
              <div className="crm3-subtitle">
                Ricerca, stato accesso, rinnovi e incassi in una vista unica.
                Pensato per lavorare veloce in reception.
              </div>
            </div>

            <div className="crm3-actions">
              <BGButton href="/customers/new">
                + Nuovo cliente
              </BGButton>
              <BGButton href="/reception" variant="secondary">
                Reception
              </BGButton>
              <BGButton type="button" onClick={loadCustomers} variant="secondary">
                Aggiorna
              </BGButton>
            </div>
          </div>

          <div className="crm3-filters">
            {LIST_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`crm3-filter-btn ${
                  listFilter === filter.value ? "crm3-filter-btn-active" : ""
                }`}
                onClick={() => {
                  setSelectedId(null);
                  setListFilter(filter.value);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </header>

        <section className="crm3-metrics" aria-label="Riepilogo clienti">
          <article className="crm3-metric crm3-metric-blue">
            <div className="crm3-metric-label">Clienti attivi</div>
            <div className="crm3-metric-value">{metrics.total}</div>
          </article>
          <article className="crm3-metric crm3-metric-green">
            <div className="crm3-metric-label">Accesso attivo</div>
            <div className="crm3-metric-value">{metrics.active}</div>
          </article>
          <article className={`crm3-metric ${metrics.attention > 0 ? "crm3-metric-red" : "crm3-metric-neutral"}`}>
            <div className="crm3-metric-label">Da verificare</div>
            <div className="crm3-metric-value">{metrics.attention}</div>
          </article>
          <article className={`crm3-metric ${metrics.expiring > 0 ? "crm3-metric-yellow" : "crm3-metric-neutral"}`}>
            <div className="crm3-metric-label">Scadenze vicine</div>
            <div className="crm3-metric-value">{metrics.expiring}</div>
          </article>
          <article className="crm3-metric crm3-metric-neutral">
            <div className="crm3-metric-label">Con badge</div>
            <div className="crm3-metric-value">{metrics.withBadge}</div>
          </article>
        </section>

        {loading && (
          <div className="crm3-message">Caricamento CRM clienti...</div>
        )}
        {queryError && (
          <div className="crm3-message crm3-message-error">{queryError}</div>
        )}

        {!queryError && loadedOnce && customers.length === 0 && (
          <BGEmptyState
            title="Nessun cliente trovato"
            description="Crea un nuovo cliente per popolare il CRM operativo."
          />
        )}

        {!loading && !queryError && customers.length > 0 && (
          <section className="crm3-workspace">
            <aside className="crm3-list-panel">
              <div className="crm3-list-head">
                <BGInput
                  className="crm3-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cerca cliente, badge, telefono o email..."
                />
                <div className="crm3-count">
                  {filteredCustomers.length} risultati su {customers.length}
                  {serverStats ? ` · ${serverStats.total_records} record totali` : ""}
                </div>
              </div>

              <div className="crm3-list">
                {filteredCustomers.map((customer) => {
                  const name = getName(customer);
                  const state = getAccessState(customer);
                  const contact =
                    customer.phone ||
                    customer.email ||
                    getBadgeCode(customer) ||
                    "Dati da completare";
                  const active = selectedCustomer?.id === customer.id;

                  return (
                    <button
                      key={customer.id}
                      type="button"
                      className={`crm3-list-item ${active ? "crm3-list-item-active" : ""}`}
                      onClick={() => setSelectedId(customer.id)}
                    >
                      <div className="crm3-avatar">{initials(name)}</div>
                      <div>
                        <div className="crm3-list-name">{name}</div>
                        <div className="crm3-list-sub">{contact}</div>
                      </div>
                      <span
                        className={`crm3-mini-dot crm3-dot-${state.tone}`}
                      />
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="crm3-detail-panel">
              {selectedCustomer && (
                <div className="crm3-detail">
                  {(() => {
                    const name = getName(selectedCustomer);
                    const state = getAccessState(selectedCustomer);
                    const subscriptionText = formatSubscriptionStatus(
                      selectedCustomer.subscription_status,
                      selectedCustomer.active,
                    );

                    return (
                      <>
                        <div className="crm3-detail-hero">
                          <div className="crm3-detail-main">
                            <div className="crm3-detail-avatar">
                              {initials(name)}
                            </div>
                            <div>
                              <div className="crm3-detail-name">{name}</div>
                              <div className="crm3-detail-contact">
                                {selectedCustomer.phone ||
                                  selectedCustomer.email ||
                                  "Contatto da completare"}
                              </div>
                            </div>
                          </div>

                          <BGStatusBadge
                            tone={
                              state.tone === "green"
                                ? "success"
                                : state.tone === "red"
                                  ? "danger"
                                  : state.tone === "yellow"
                                    ? "warning"
                                    : "neutral"
                            }
                          >
                            {state.label}
                          </BGStatusBadge>
                        </div>

                        <div className="crm3-detail-grid">
                          <div className="crm3-info">
                            <span>Telefono</span>
                            <strong>
                              {selectedCustomer.phone || "Non inserito"}
                            </strong>
                          </div>

                          <div className="crm3-info">
                            <span>Email</span>
                            <strong>
                              {selectedCustomer.email || "Non inserita"}
                            </strong>
                          </div>

                          <div className="crm3-info">
                            <span>Badge</span>
                            <strong>
                              {getBadgeCode(selectedCustomer) || "Da associare"}
                            </strong>
                          </div>

                          <div className="crm3-info">
                            <span>Abbonamento</span>
                            <strong>{subscriptionText}</strong>
                          </div>

                          <div className="crm3-info">
                            <span>Scadenza</span>
                            <strong>
                              {formatDate(selectedCustomer.subscription_expiry)}
                            </strong>
                          </div>

                          <div className="crm3-info">
                            <span>Stato</span>
                            <strong>{state.hint}</strong>
                          </div>

                          <div className="crm3-info">
                            <span>Creato il</span>
                            <strong>
                              {formatDate(selectedCustomer.created_at)}
                            </strong>
                          </div>

                          <div className="crm3-info">
                            <span>ID operativo</span>
                            <strong>{selectedCustomer.id.slice(0, 8)}</strong>
                          </div>
                        </div>

                        <div className="crm3-action-grid">
                          <Link className="crm3-action crm3-action-primary" href={`/customers/${selectedCustomer.id}`}>
                            <span className="crm3-action-icon" aria-hidden="true">↗</span>
                            <span className="crm3-action-copy"><strong>Apri scheda</strong><span>Profilo completo del cliente</span></span>
                            <span className="crm3-action-arrow" aria-hidden="true">›</span>
                          </Link>
                          <Link className="crm3-action" href={`/customers/${selectedCustomer.id}`}>
                            <span className="crm3-action-icon" aria-hidden="true">⟳</span>
                            <span className="crm3-action-copy"><strong>Rinnova</strong><span>Abbonamento o quota</span></span>
                            <span className="crm3-action-arrow" aria-hidden="true">›</span>
                          </Link>
                          <Link className="crm3-action" href={`/payments?customer=${selectedCustomer.id}`}>
                            <span className="crm3-action-icon" aria-hidden="true">€</span>
                            <span className="crm3-action-copy"><strong>Registra incasso</strong><span>Nuovo pagamento</span></span>
                            <span className="crm3-action-arrow" aria-hidden="true">›</span>
                          </Link>
                          <Link className="crm3-action" href={`/customers/${selectedCustomer.id}`}>
                            <span className="crm3-action-icon" aria-hidden="true">◇</span>
                            <span className="crm3-action-copy"><strong>Gestisci accesso</strong><span>Badge, QR e Mobile Pass</span></span>
                            <span className="crm3-action-arrow" aria-hidden="true">›</span>
                          </Link>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </section>
          </section>
        )}
      </div>
    </section>
  );
}
