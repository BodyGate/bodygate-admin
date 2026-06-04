"use client";

import { useEffect, useMemo, useState } from "react";
import BGButton from "../components/ui/BGButton";
import BGCard from "../components/ui/BGCard";
import BGEmptyState from "../components/ui/BGEmptyState";
import BGPageHeader from "../components/ui/BGPageHeader";
import BGStatCard from "../components/ui/BGStatCard";
import BGStatusBadge from "../components/ui/BGStatusBadge";
import "../components/ui/bodygate-ui.css";
import { supabase } from "../lib/supabaseClient";

type Customer = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  badge_code: string | null;
  is_active: boolean | null;
};

type SubscriptionPlan = {
  name: string | null;
  is_active: boolean | null;
};

type SubscriptionRow = {
  customer_id: string;
  plan_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  amount: number | string | null;
  created_at: string | null;
  customers: Customer | Customer[] | null;
  subscription_plans: SubscriptionPlan | SubscriptionPlan[] | null;
};

type SubscriptionStatus = {
  label: "Scaduto" | "In scadenza" | "Attivo" | "Disattivato";
  tone: "success" | "danger" | "warning" | "neutral";
  rank: number;
};

type Metrics = {
  active: number;
  expiringSoon: number;
  expired: number;
  activePlans: number;
  monthRevenue: number;
};

const DAY_MS = 1000 * 60 * 60 * 24;

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysUntil(value?: string | null) {
  if (!value) return null;

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;

  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - startOfToday().getTime()) / DAY_MS);
}

function dateRank(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function latestRank(subscription: SubscriptionRow) {
  return Math.max(
    dateRank(subscription.created_at),
    dateRank(subscription.starts_at),
    dateRank(subscription.ends_at)
  );
}

function isLatestSubscription(candidate: SubscriptionRow, current: SubscriptionRow) {
  const candidateRank = latestRank(candidate);
  const currentRank = latestRank(current);

  if (candidateRank !== currentRank) return candidateRank > currentRank;
  return dateRank(candidate.ends_at) > dateRank(current.ends_at);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function euro(value: number | string | null | undefined) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function customerName(customer: Customer | null) {
  const name = `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim();
  return name || "Cliente senza nome";
}

function subscriptionStatus(subscription: SubscriptionRow): SubscriptionStatus {
  const customer = firstRelation(subscription.customers);
  const remainingDays = daysUntil(subscription.ends_at);

  if (customer?.is_active === false) {
    return { label: "Disattivato", tone: "neutral", rank: 3 };
  }

  if (remainingDays === null || remainingDays < 0) {
    return { label: "Scaduto", tone: "danger", rank: 0 };
  }

  if (remainingDays <= 7) {
    return { label: "In scadenza", tone: "warning", rank: 1 };
  }

  return { label: "Attivo", tone: "success", rank: 2 };
}

function formatRemainingDays(subscription: SubscriptionRow) {
  const status = subscriptionStatus(subscription);
  const remainingDays = daysUntil(subscription.ends_at);

  if (status.label === "Disattivato") return "—";
  if (remainingDays === null) return "—";
  if (remainingDays < 0) return `${Math.abs(remainingDays)} gg fa`;
  return `${remainingDays} gg`;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");

  async function loadSubscriptions(showLoading = true) {
    try {
      if (showLoading) {
        setLoading(true);
        setErrorMessage("");
      }

      const { data, error } = await supabase
        .from("customer_subscriptions")
        .select(`
          customer_id,
          plan_id,
          starts_at,
          ends_at,
          amount,
          created_at,
          customers (
            first_name,
            last_name,
            phone,
            badge_code,
            is_active
          ),
          subscription_plans (
            name,
            is_active
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSubscriptions((data || []) as SubscriptionRow[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore imprevisto durante il caricamento.";
      setErrorMessage(message);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSubscriptions(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const currentSubscriptions = useMemo(() => {
    const latestByCustomer = new Map<string, SubscriptionRow>();

    subscriptions.forEach((subscription) => {
      const current = latestByCustomer.get(subscription.customer_id);

      if (!current || isLatestSubscription(subscription, current)) {
        latestByCustomer.set(subscription.customer_id, subscription);
      }
    });

    return Array.from(latestByCustomer.values()).sort((left, right) => {
      const leftStatus = subscriptionStatus(left);
      const rightStatus = subscriptionStatus(right);

      if (leftStatus.rank !== rightStatus.rank) return leftStatus.rank - rightStatus.rank;

      const leftDays = daysUntil(left.ends_at) ?? Number.MAX_SAFE_INTEGER;
      const rightDays = daysUntil(right.ends_at) ?? Number.MAX_SAFE_INTEGER;
      return leftDays - rightDays;
    });
  }, [subscriptions]);

  const metrics = useMemo<Metrics>(() => {
    const today = startOfToday();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const activePlanIds = new Set<string>();

    return currentSubscriptions.reduce(
      (totals, subscription) => {
        const status = subscriptionStatus(subscription);
        const plan = firstRelation(subscription.subscription_plans);
        const createdAt = subscription.created_at ? new Date(subscription.created_at) : null;

        if (status.label === "Attivo" || status.label === "In scadenza") {
          totals.active += 1;
        }

        if (status.label === "In scadenza") totals.expiringSoon += 1;
        if (status.label === "Scaduto") totals.expired += 1;

        if (subscription.plan_id && plan?.is_active !== false) {
          activePlanIds.add(subscription.plan_id);
        }

        if (createdAt && createdAt >= monthStart && createdAt < nextMonthStart) {
          totals.monthRevenue += Number(subscription.amount || 0);
        }

        totals.activePlans = activePlanIds.size;
        return totals;
      },
      { active: 0, expiringSoon: 0, expired: 0, activePlans: 0, monthRevenue: 0 }
    );
  }, [currentSubscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return currentSubscriptions;

    return currentSubscriptions.filter((subscription) => {
      const customer = firstRelation(subscription.customers);
      const plan = firstRelation(subscription.subscription_plans);

      return [
        customerName(customer),
        customer?.phone || "",
        customer?.badge_code || "",
        plan?.name || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(value);
    });
  }, [currentSubscriptions, search]);

  return (
    <main className="subscriptions-page-v2">
      <BGPageHeader
        eyebrow="BodyGate Abbonamenti"
        title="Abbonamenti"
        subtitle="Vista operativa degli abbonamenti correnti: una riga per cliente, KPI sullo stato attuale e accesso rapido alla scheda cliente per gestire i rinnovi."
        actions={
          <div className="subscriptions-actions">
            <BGStatusBadge tone={errorMessage ? "danger" : "success"}>
              {errorMessage ? "Errore dati" : "Supabase live"}
            </BGStatusBadge>
            <BGButton onClick={loadSubscriptions} variant="secondary" disabled={loading}>
              Aggiorna
            </BGButton>
          </div>
        }
      />

      <section className="subscriptions-kpi-grid">
        <BGStatCard label="Attivi" value={metrics.active} note="Abbonamenti validi oggi" tone="green" />
        <BGStatCard label="In scadenza" value={metrics.expiringSoon} note="Entro i prossimi 7 giorni" tone="yellow" />
        <BGStatCard label="Scaduti" value={metrics.expired} note="Da recuperare o archiviare" tone={metrics.expired > 0 ? "red" : "neutral"} />
        <BGStatCard label="Piani attivi" value={metrics.activePlans} note="Piani collegati agli ultimi abbonamenti" tone="blue" />
        <BGStatCard label="Incasso mese" value={euro(metrics.monthRevenue)} note="Ultimi abbonamenti cliente creati nel mese" tone="green" />
      </section>

      <BGCard>
        <div className="subscriptions-panel-head">
          <div>
            <div className="subscriptions-panel-title">Scadenziario abbonamenti</div>
            <div className="subscriptions-panel-subtitle">
              Mostra solo l&apos;ultimo abbonamento per cliente. Lo storico completo resta nella scheda cliente.
            </div>
          </div>

          <input
            className="subscriptions-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca cliente, badge, telefono o piano..."
          />
        </div>

        {errorMessage && <div className="subscriptions-error">{errorMessage}</div>}

        {loading ? (
          <div className="subscriptions-loading">Caricamento abbonamenti...</div>
        ) : filteredSubscriptions.length === 0 ? (
          <BGEmptyState
            title="Nessun abbonamento trovato"
            description="Quando saranno presenti abbonamenti in customer_subscriptions, compariranno in questa vista operativa."
          />
        ) : (
          <div className="subscriptions-table-wrap">
            <table className="subscriptions-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Badge / telefono</th>
                  <th>Piano</th>
                  <th>Periodo</th>
                  <th>Stato</th>
                  <th>Giorni residui</th>
                  <th>Importo</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((subscription) => {
                  const customer = firstRelation(subscription.customers);
                  const plan = firstRelation(subscription.subscription_plans);
                  const status = subscriptionStatus(subscription);
                  const remainingDays = daysUntil(subscription.ends_at);
                  const daysClass = status.label === "Scaduto" ? "danger" : status.label === "In scadenza" ? "warning" : "";

                  return (
                    <tr key={subscription.customer_id}>
                      <td>
                        <div className="customer-name">{customerName(customer)}</div>
                      </td>
                      <td>
                        <div className="contact-stack">
                          <span>{customer?.badge_code ? `Badge ${customer.badge_code}` : "Badge —"}</span>
                          <span>{customer?.phone || "Telefono —"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="plan-name">{plan?.name || "Piano non assegnato"}</div>
                        <div className="plan-state">{plan?.is_active === false ? "Piano disattivato" : "Piano attivo"}</div>
                      </td>
                      <td>
                        <div className="period-range">{formatDate(subscription.starts_at)} → {formatDate(subscription.ends_at)}</div>
                      </td>
                      <td>
                        <BGStatusBadge tone={status.tone}>{status.label}</BGStatusBadge>
                      </td>
                      <td>
                        <span className={`days-pill ${daysClass}`}>
                          {remainingDays === null && status.label === "Scaduto" ? "Scaduto" : formatRemainingDays(subscription)}
                        </span>
                      </td>
                      <td className="amount-cell">{euro(subscription.amount)}</td>
                      <td>
                        <BGButton href={`/customers/${subscription.customer_id}`} variant="ghost">
                          Apri scheda cliente
                        </BGButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </BGCard>

      <style jsx>{`
        .subscriptions-page-v2 {
          min-height: 100vh;
          padding: 26px;
          color: #fff;
          background:
            radial-gradient(circle at top left, rgba(239, 68, 68, 0.24), transparent 30%),
            radial-gradient(circle at 76% 8%, rgba(255, 255, 255, 0.08), transparent 25%),
            linear-gradient(135deg, #050505, #090909 48%, #111);
        }

        .subscriptions-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .subscriptions-kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .subscriptions-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding-bottom: 18px;
          margin-bottom: 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .subscriptions-panel-title {
          font-size: 24px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.055em;
        }

        .subscriptions-panel-subtitle {
          margin-top: 8px;
          color: #9f9f9f;
          font-size: 13px;
          line-height: 1.5;
        }

        .subscriptions-search {
          width: min(100%, 380px);
          min-height: 46px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.065);
          color: #fff;
          outline: none;
          padding: 0 15px;
          font-size: 13px;
          font-weight: 800;
        }

        .subscriptions-search::placeholder {
          color: #777;
        }

        .subscriptions-error,
        .subscriptions-loading {
          border-radius: 18px;
          padding: 16px;
          border: 1px solid rgba(239, 68, 68, 0.28);
          background: rgba(239, 68, 68, 0.1);
          color: #fecaca;
          font-size: 13px;
          font-weight: 850;
        }

        .subscriptions-loading {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.045);
          color: #d4d4d4;
        }

        .subscriptions-table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 22px;
        }

        .subscriptions-table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
        }

        .subscriptions-table th {
          padding: 15px 16px;
          text-align: left;
          color: #a3a3a3;
          background: rgba(255, 255, 255, 0.045);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .subscriptions-table td {
          padding: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.075);
          color: #e5e5e5;
          font-size: 13px;
          vertical-align: middle;
        }

        .subscriptions-table tbody tr {
          background: rgba(255, 255, 255, 0.018);
        }

        .subscriptions-table tbody tr:hover {
          background: rgba(239, 68, 68, 0.055);
        }

        .customer-name,
        .plan-name,
        .amount-cell {
          color: #fff;
          font-weight: 950;
        }

        .plan-state,
        .contact-stack,
        .period-range {
          color: #9f9f9f;
          font-size: 12px;
          line-height: 1.45;
        }

        .contact-stack {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .days-pill {
          display: inline-flex;
          min-width: 76px;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 10px;
          border: 1px solid rgba(34, 197, 94, 0.24);
          background: rgba(34, 197, 94, 0.09);
          color: #86efac;
          font-size: 12px;
          font-weight: 950;
        }

        .days-pill.warning {
          border-color: rgba(250, 204, 21, 0.28);
          background: rgba(250, 204, 21, 0.09);
          color: #fde68a;
        }

        .days-pill.danger {
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.1);
          color: #fecaca;
        }

        @media (max-width: 1180px) {
          .subscriptions-kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .subscriptions-page-v2 {
            padding: 16px;
          }

          .subscriptions-kpi-grid {
            grid-template-columns: 1fr;
          }

          .subscriptions-panel-head {
            align-items: stretch;
            flex-direction: column;
          }

          .subscriptions-search {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
