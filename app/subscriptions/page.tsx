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
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  badge_code: string | null;
};

type SubscriptionPlan = {
  id: string;
  name: string | null;
  is_active: boolean | null;
};

type SubscriptionRow = {
  id: string;
  customer_id: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
  amount: number | string | null;
  created_at: string | null;
  customers: Customer | Customer[] | null;
  subscription_plans: SubscriptionPlan | SubscriptionPlan[] | null;
};

type SubscriptionStatus = "Scaduto" | "In scadenza" | "Attivo" | "Disattivato";

type StatusView = {
  label: SubscriptionStatus;
  tone: "success" | "danger" | "warning" | "neutral";
};

const DAY_MS = 1000 * 60 * 60 * 24;

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function dateOnly(date: Date) {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const today = dateOnly(new Date());
  const target = dateOnly(new Date(value));

  if (Number.isNaN(target.getTime())) return null;

  return Math.ceil((target.getTime() - today.getTime()) / DAY_MS);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT", {
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
  const name =
    `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim();
  return name || "Cliente senza nome";
}

function subscriptionStatus(subscription: SubscriptionRow): StatusView {
  const remainingDays = daysUntil(subscription.ends_at);

  if (subscription.is_active === false) {
    return { label: "Disattivato", tone: "neutral" };
  }

  if (remainingDays !== null && remainingDays < 0) {
    return { label: "Scaduto", tone: "danger" };
  }

  if (remainingDays !== null && remainingDays <= 7) {
    return { label: "In scadenza", tone: "warning" };
  }

  return { label: "Attivo", tone: "success" };
}

function latestDateValue(subscription: SubscriptionRow) {
  const candidates = [
    subscription.created_at,
    subscription.starts_at,
    subscription.ends_at,
  ]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => !Number.isNaN(value));

  return Math.max(...candidates, 0);
}

function latestSubscriptionsByCustomer(subscriptions: SubscriptionRow[]) {
  const latestByCustomer = new Map<string, SubscriptionRow>();

  subscriptions.forEach((subscription) => {
    const current = latestByCustomer.get(subscription.customer_id);

    if (!current || latestDateValue(subscription) > latestDateValue(current)) {
      latestByCustomer.set(subscription.customer_id, subscription);
    }
  });

  return Array.from(latestByCustomer.values());
}

function statusRank(subscription: SubscriptionRow) {
  const ranks: Record<SubscriptionStatus, number> = {
    Scaduto: 0,
    "In scadenza": 1,
    Attivo: 2,
    Disattivato: 3,
  };

  return ranks[subscriptionStatus(subscription).label];
}

function sortSubscriptions(subscriptions: SubscriptionRow[]) {
  return [...subscriptions].sort((left, right) => {
    const rankDiff = statusRank(left) - statusRank(right);
    if (rankDiff !== 0) return rankDiff;

    const leftDays = daysUntil(left.ends_at) ?? Number.MAX_SAFE_INTEGER;
    const rightDays = daysUntil(right.ends_at) ?? Number.MAX_SAFE_INTEGER;
    if (leftDays !== rightDays) return leftDays - rightDays;

    return latestDateValue(right) - latestDateValue(left);
  });
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
        .select(
          `
          id,
          customer_id,
          starts_at,
          ends_at,
          is_active,
          amount,
          created_at,
          customers (
            id,
            first_name,
            last_name,
            phone,
            badge_code
          ),
          subscription_plans (
            id,
            name,
            is_active
          )
        `,
        )
        .order("created_at", { ascending: false })
        .order("starts_at", { ascending: false })
        .order("ends_at", { ascending: false });

      if (error) throw error;

      const latestSubscriptions = latestSubscriptionsByCustomer(
        (data || []) as SubscriptionRow[],
      );
      setSubscriptions(sortSubscriptions(latestSubscriptions));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante il caricamento.";
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

  const metrics = useMemo(() => {
    const today = dateOnly(new Date());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthStart = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      1,
    );
    const activePlanIds = new Set<string>();

    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let monthRevenue = 0;

    subscriptions.forEach((subscription) => {
      const status = subscriptionStatus(subscription).label;
      const plan = firstRelation(subscription.subscription_plans);
      const createdAt = subscription.created_at
        ? new Date(subscription.created_at)
        : null;

      if (status === "Attivo") {
        active += 1;
      }

      if (status === "In scadenza") {
        expiringSoon += 1;
      }

      if (status === "Scaduto") {
        expired += 1;
      }

      if (plan?.id && plan.is_active !== false) {
        activePlanIds.add(plan.id);
      }

      if (createdAt && createdAt >= monthStart && createdAt < nextMonthStart) {
        monthRevenue += Number(subscription.amount || 0);
      }
    });

    return {
      active,
      expiringSoon,
      expired,
      activePlans: activePlanIds.size,
      monthRevenue,
    };
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return subscriptions;

    return subscriptions.filter((subscription) => {
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
  }, [subscriptions, search]);

  return (
    <main className="subscriptions-page-v2">
      <BGPageHeader
        eyebrow="BodyGate Abbonamenti"
        title="Abbonamenti"
        subtitle="Controllo operativo degli abbonamenti: scadenze, incassi del mese e accesso rapido alla scheda cliente per rinnovi e dettagli."
        actions={
          <div className="subscriptions-actions">
            <BGStatusBadge tone={errorMessage ? "danger" : "success"}>
              {errorMessage ? "Errore dati" : "Supabase live"}
            </BGStatusBadge>
            <BGButton
              onClick={loadSubscriptions}
              variant="secondary"
              disabled={loading}
            >
              Aggiorna
            </BGButton>
          </div>
        }
      />

      <section className="subscriptions-kpi-grid">
        <BGStatCard
          label="Attivi"
          value={metrics.active}
          note="Abbonamenti validi oggi"
          tone="green"
        />
        <BGStatCard
          label="In scadenza"
          value={metrics.expiringSoon}
          note="Entro i prossimi 7 giorni"
          tone="yellow"
        />
        <BGStatCard
          label="Scaduti"
          value={metrics.expired}
          note="Da recuperare o archiviare"
          tone={metrics.expired > 0 ? "red" : "neutral"}
        />
        <BGStatCard
          label="Piani attivi"
          value={metrics.activePlans}
          note="Piani collegati agli abbonamenti"
          tone="blue"
        />
        <BGStatCard
          label="Incasso mese"
          value={euro(metrics.monthRevenue)}
          note="Somma abbonamenti creati nel mese"
          tone="green"
        />
      </section>

      <BGCard>
        <div className="subscriptions-panel-head">
          <div>
            <div className="subscriptions-panel-title">
              Scadenziario abbonamenti
            </div>
            <div className="subscriptions-panel-subtitle">
              Il rinnovo resta nella scheda cliente: da qui si consulta e si
              apre il profilo corretto.
            </div>
          </div>

          <input
            className="subscriptions-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca cliente, badge, telefono o piano..."
          />
        </div>

        {errorMessage && (
          <div className="subscriptions-error">{errorMessage}</div>
        )}

        {loading ? (
          <div className="subscriptions-loading">
            Caricamento abbonamenti...
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <BGEmptyState
            title="Nessun abbonamento trovato"
            description="Quando saranno presenti abbonamenti in customer_subscriptions, compariranno in questa vista."
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

                  return (
                    <tr key={subscription.id}>
                      <td>
                        <div className="customer-name">
                          {customerName(customer)}
                        </div>
                        <div className="customer-id">
                          Ultimo abbonamento cliente
                        </div>
                      </td>
                      <td>
                        <div className="contact-stack">
                          <span>
                            {customer?.badge_code
                              ? `Badge ${customer.badge_code}`
                              : "Badge —"}
                          </span>
                          <span>{customer?.phone || "Telefono —"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="plan-name">
                          {plan?.name || "Piano non assegnato"}
                        </div>
                        <div className="plan-state">
                          {plan?.is_active === false
                            ? "Piano disattivato"
                            : "Piano attivo"}
                        </div>
                      </td>
                      <td>
                        <div className="period-range">
                          {formatDate(subscription.starts_at)} →{" "}
                          {formatDate(subscription.ends_at)}
                        </div>
                      </td>
                      <td>
                        <BGStatusBadge tone={status.tone}>
                          {status.label}
                        </BGStatusBadge>
                      </td>
                      <td>
                        <span
                          className={`days-pill ${remainingDays !== null && remainingDays < 0 ? "danger" : remainingDays !== null && remainingDays <= 7 ? "warning" : ""}`}
                        >
                          {remainingDays === null
                            ? "—"
                            : remainingDays < 0
                              ? `${Math.abs(remainingDays)} gg fa`
                              : `${remainingDays} gg`}
                        </span>
                      </td>
                      <td className="amount-cell">
                        {euro(subscription.amount)}
                      </td>
                      <td>
                        <BGButton
                          href={`/customers/${subscription.customer_id}`}
                          variant="ghost"
                        >
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
            radial-gradient(
              circle at top left,
              rgba(239, 68, 68, 0.24),
              transparent 30%
            ),
            radial-gradient(
              circle at 76% 8%,
              rgba(255, 255, 255, 0.08),
              transparent 25%
            ),
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

        .customer-id,
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

          .subscriptions-kpi-grid,
          .subscriptions-panel-head {
            grid-template-columns: 1fr;
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
