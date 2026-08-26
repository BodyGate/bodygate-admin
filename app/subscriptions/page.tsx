"use client";

import { BGButton, BGCard, BGEmptyState, BGPageHeader, BGPageShell, BGStatCard, BGStatusBadge } from "@/components/bodygate-ui";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  badge_code: string | null;
  is_active: boolean | null;
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
type StatusFilter =
  | "Tutti"
  | "Scaduti"
  | "In scadenza"
  | "Attivi"
  | "Disattivati";
type AccessFilter = "Tutti" | "Accesso OK" | "Accesso bloccato";
type AccessStatus = "Accesso OK" | "Accesso bloccato";

type StatusView = {
  label: SubscriptionStatus;
  tone: "success" | "danger" | "warning" | "neutral";
};

const DAY_MS = 1000 * 60 * 60 * 24;
const STATUS_FILTERS: StatusFilter[] = [
  "Tutti",
  "Attivi",
  "In scadenza",
  "Scaduti",
  "Disattivati",
];
const ACCESS_FILTERS: AccessFilter[] = [
  "Tutti",
  "Accesso OK",
  "Accesso bloccato",
];

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

function accessStatus(subscription: SubscriptionRow): AccessStatus {
  const customer = firstRelation(subscription.customers);
  const status = subscriptionStatus(subscription).label;
  const subscriptionAllowsAccess =
    subscription.is_active !== false && status !== "Scaduto";
  const customerAllowsAccess = customer ? customer.is_active !== false : false;

  return subscriptionAllowsAccess && customerAllowsAccess
    ? "Accesso OK"
    : "Accesso bloccato";
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

function filterMatchesStatus(
  subscription: SubscriptionRow,
  statusFilter: StatusFilter,
) {
  const status = subscriptionStatus(subscription).label;

  if (statusFilter === "Tutti") return true;
  if (statusFilter === "Attivi") return status === "Attivo";
  if (statusFilter === "Scaduti") return status === "Scaduto";
  if (statusFilter === "Disattivati") return status === "Disattivato";

  return status === "In scadenza";
}

function endDateValue(subscription: SubscriptionRow) {
  const value = subscription.ends_at
    ? new Date(subscription.ends_at).getTime()
    : Number.NaN;

  return Number.isNaN(value) ? 0 : value;
}

function filterMatchesAccess(
  subscription: SubscriptionRow,
  accessFilter: AccessFilter,
) {
  if (accessFilter === "Tutti") return true;

  return accessStatus(subscription) === accessFilter;
}

function subscriptionRowClass(subscription: SubscriptionRow) {
  const status = subscriptionStatus(subscription).label;

  if (status === "Scaduto") return "subscription-row subscription-row-expired";
  if (status === "In scadenza")
    return "subscription-row subscription-row-expiring";

  return "subscription-row";
}

function sortSubscriptions(subscriptions: SubscriptionRow[]) {
  return [...subscriptions].sort((left, right) => {
    const rankDiff = statusRank(left) - statusRank(right);
    if (rankDiff !== 0) return rankDiff;

    const leftStatus = subscriptionStatus(left).label;

    if (leftStatus === "Scaduto") {
      const endDiff = endDateValue(right) - endDateValue(left);
      if (endDiff !== 0) return endDiff;
    }

    if (leftStatus === "In scadenza" || leftStatus === "Attivo") {
      const leftDays = daysUntil(left.ends_at) ?? Number.MAX_SAFE_INTEGER;
      const rightDays = daysUntil(right.ends_at) ?? Number.MAX_SAFE_INTEGER;
      if (leftDays !== rightDays) return leftDays - rightDays;
    }

    return latestDateValue(right) - latestDateValue(left);
  });
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Tutti");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("Tutti");

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
            badge_code,
            is_active
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

    return subscriptions.filter((subscription) => {
      if (!filterMatchesStatus(subscription, statusFilter)) return false;
      if (!filterMatchesAccess(subscription, accessFilter)) return false;

      if (!value) return true;

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
  }, [subscriptions, search, statusFilter, accessFilter]);

  return (
    <main className="subscriptions-page-v2">
      <BGPageShell>
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

          <div className="subscriptions-tools">
            <div
              className="subscriptions-filters"
              aria-label="Filtra per stato"
            >
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter}
                  className={`subscriptions-filter ${statusFilter === filter ? "active" : ""}`}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div
              className="subscriptions-filters subscriptions-access-filters"
              aria-label="Filtra per accesso"
            >
              {ACCESS_FILTERS.map((filter) => (
                <button
                  key={filter}
                  className={`subscriptions-filter ${accessFilter === filter ? "active" : ""}`}
                  type="button"
                  onClick={() => setAccessFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
            <input
              className="subscriptions-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca cliente, badge, telefono o piano..."
            />
            <div className="subscriptions-found-count">
              {filteredSubscriptions.length} clienti trovati
            </div>
          </div>
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
                  <th>Accesso</th>
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
                  const access = accessStatus(subscription);

                  return (
                    <tr
                      key={subscription.id}
                      className={subscriptionRowClass(subscription)}
                    >
                      <td>
                        <div className="customer-name">
                          {customerName(customer)}
                        </div>
                      </td>
                      <td>
                        <div className="contact-stack">
                          <span>Badge: {customer?.badge_code || "—"}</span>
                          <span>Tel: {customer?.phone || "—"}</span>
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
                        <BGStatusBadge
                          tone={access === "Accesso OK" ? "success" : "danger"}
                        >
                          {access}
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
                        <div className="subscription-action-stack">
                          <BGButton
                            href={`/customers/${subscription.customer_id}`}
                            variant="ghost"
                          >
                            Apri scheda cliente
                          </BGButton>
                          <BGButton
                            href={`/customers/${subscription.customer_id}`}
                            variant="secondary"
                          >
                            Rinnova
                          </BGButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </BGCard>

      </BGPageShell>

      <style jsx>{`
        .subscriptions-page-v2 {
          min-height: 100vh;
          padding: 18px 20px 26px;
          color: #fff;
          background:
            radial-gradient(
              circle at top left,
              rgba(91, 61, 245, 0.24),
              transparent 30%
            ),
            radial-gradient(
              circle at 76% 8%,
              rgba(255, 255, 255, 0.08),
              transparent 25%
            ),
            linear-gradient(135deg, #050505, #090909 48%, #111);
        }

        .subscriptions-page-v2 :global([class*="pageShell"]) {
          gap: 14px;
        }

        .subscriptions-page-v2 :global([class*="pageHeader"]) {
          align-items: center;
          padding: 18px 20px;
          min-height: 0;
        }

        .subscriptions-page-v2 :global([class*="title"]) {
          margin-top: 6px;
          font-size: clamp(28px, 2.4vw, 38px);
          line-height: 1.05;
        }

        .subscriptions-page-v2 :global([class*="subtitle"]) {
          max-width: 680px;
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.45;
        }

        .subscriptions-page-v2 :global([class*="eyebrow"]) {
          font-size: 11px;
        }

        .subscriptions-page-v2 :global([class*="statCard"]) {
          min-height: 106px;
          gap: 10px;
          padding: 14px 16px;
        }

        .subscriptions-page-v2 :global([class*="statValue"]) {
          margin-top: 4px;
          font-size: clamp(24px, 2vw, 31px);
          line-height: 1.06;
          word-break: normal;
        }

        .subscriptions-page-v2 :global([class*="statNote"]) {
          padding-top: 9px;
          font-size: 12px;
          line-height: 1.35;
        }

        .subscriptions-page-v2 :global([class*="label"]) {
          font-size: 10.5px;
          letter-spacing: 0.14em;
        }

        .subscriptions-page-v2 :global([class*="card"]) {
          padding: 16px;
        }

        .subscriptions-page-v2 :global([class*="button"]) {
          min-height: 36px;
          padding-inline: 13px;
          font-size: 12px;
        }

        .subscriptions-page-v2 :global([class*="badge"]) {
          min-height: 26px;
          font-size: 11px;
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
          gap: 12px;
          margin-bottom: 0;
        }

        .subscriptions-panel-head {
          display: grid;
          grid-template-columns: minmax(260px, 0.75fr) minmax(0, 1.25fr);
          align-items: start;
          gap: 16px;
          padding-bottom: 14px;
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(21, 22, 28, 0.1);
        }

        .subscriptions-panel-title {
          font-size: 20px;
          line-height: 1.1;
          font-weight: 900;
          letter-spacing: 0;
        }

        .subscriptions-panel-subtitle {
          margin-top: 6px;
          color: #9f9f9f;
          font-size: 12px;
          line-height: 1.42;
        }

        .subscriptions-tools {
          display: grid;
          width: 100%;
          grid-template-columns: 1fr minmax(220px, 320px);
          align-items: start;
          gap: 8px 10px;
        }

        .subscriptions-filters {
          display: flex;
          justify-content: flex-start;
          gap: 7px;
          flex-wrap: wrap;
        }

        .subscriptions-access-filters {
          grid-column: 1 / 2;
        }

        .subscriptions-filter {
          min-height: 31px;
          border: 1px solid rgba(21, 22, 28, 0.1);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.055);
          color: #bdbdbd;
          cursor: pointer;
          font-size: 11px;
          font-weight: 900;
          padding: 0 10px;
          transition:
            border-color 0.2s ease,
            background 0.2s ease,
            color 0.2s ease;
        }

        .subscriptions-filter:hover,
        .subscriptions-filter.active {
          border-color: rgba(91, 61, 245, 0.42);
          background: rgba(91, 61, 245, 0.14);
          color: #fff;
        }

        .subscriptions-search {
          grid-column: 2 / 3;
          grid-row: 1 / span 2;
          width: 100%;
          min-height: 38px;
          border-radius: 8px;
          border: 1px solid rgba(21, 22, 28, 0.1);
          background: rgba(5, 5, 6, 0.78);
          color: #fff;
          outline: none;
          padding: 0 12px;
          font-size: 12px;
          font-weight: 800;
        }

        .subscriptions-search::placeholder {
          color: #777;
        }

        .subscriptions-found-count {
          grid-column: 2 / 3;
          justify-self: end;
          color: #bdbdbd;
          font-size: 11px;
          font-weight: 900;
        }

        .subscriptions-error,
        .subscriptions-loading {
          border-radius: 18px;
          padding: 16px;
          border: 1px solid rgba(91, 61, 245, 0.28);
          background: rgba(91, 61, 245, 0.1);
          color: #fecaca;
          font-size: 13px;
          font-weight: 850;
        }

        .subscriptions-loading {
          border-color: rgba(21, 22, 28, 0.1);
          background: rgba(255, 255, 255, 0.045);
          color: #d4d4d4;
        }

        .subscriptions-table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(21, 22, 28, 0.1);
          border-radius: 8px;
        }

        .subscriptions-table {
          width: 100%;
          min-width: 1120px;
          border-collapse: collapse;
        }

        .subscriptions-table th {
          padding: 11px 12px;
          text-align: left;
          color: #a3a3a3;
          background: rgba(255, 255, 255, 0.045);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .subscriptions-table td {
          padding: 11px 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.075);
          color: #e5e5e5;
          font-size: 12px;
          vertical-align: middle;
        }

        .subscriptions-table tbody tr {
          background: rgba(255, 255, 255, 0.018);
        }

        .subscriptions-table tbody tr.subscription-row-expired {
          box-shadow:
            inset 3px 0 0 rgba(91, 61, 245, 0.72),
            0 0 18px rgba(91, 61, 245, 0.08);
          background: rgba(91, 61, 245, 0.035);
        }

        .subscriptions-table tbody tr.subscription-row-expired td {
          border-top-color: rgba(91, 61, 245, 0.22);
        }

        .subscriptions-table tbody tr.subscription-row-expiring {
          box-shadow:
            inset 3px 0 0 rgba(250, 204, 21, 0.68),
            0 0 18px rgba(250, 204, 21, 0.07);
          background: rgba(250, 204, 21, 0.032);
        }

        .subscriptions-table tbody tr.subscription-row-expiring td {
          border-top-color: rgba(250, 204, 21, 0.2);
        }

        .subscriptions-table tbody tr:hover {
          background: rgba(91, 61, 245, 0.055);
        }

        .customer-name,
        .plan-name,
        .amount-cell {
          color: #fff;
          font-weight: 950;
          max-width: 240px;
          white-space: normal;
          overflow-wrap: anywhere;
          line-height: 1.3;
        }

        .customer-id,
        .plan-state,
        .contact-stack,
        .period-range {
          color: #9f9f9f;
          font-size: 11px;
          line-height: 1.35;
        }

        .contact-stack {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          max-width: 220px;
          overflow-wrap: anywhere;
        }

        .days-pill {
          display: inline-flex;
          min-width: 76px;
          justify-content: center;
          border-radius: 999px;
          padding: 6px 9px;
          border: 1px solid rgba(34, 197, 94, 0.24);
          background: rgba(34, 197, 94, 0.09);
          color: #86efac;
          font-size: 11px;
          font-weight: 950;
        }

        .days-pill.warning {
          border-color: rgba(250, 204, 21, 0.28);
          background: rgba(250, 204, 21, 0.09);
          color: #fde68a;
        }

        .days-pill.danger {
          border-color: rgba(91, 61, 245, 0.3);
          background: rgba(91, 61, 245, 0.1);
          color: #fecaca;
        }

        .subscription-action-stack {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          min-width: 0;
        }

        .subscription-action-stack :global([class*="button"]) {
          min-height: 32px;
          padding: 0 12px;
        }

        @media (max-width: 1180px) {
          .subscriptions-kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .subscriptions-panel-head,
          .subscriptions-tools {
            grid-template-columns: 1fr;
          }

          .subscriptions-search,
          .subscriptions-found-count,
          .subscriptions-access-filters {
            grid-column: auto;
            grid-row: auto;
          }

          .subscriptions-found-count {
            justify-self: start;
          }
        }

        @media (max-width: 760px) {
          .subscriptions-page-v2 {
            padding: 14px;
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
          }

          .subscriptions-tools,
          .subscriptions-search {
            width: 100%;
          }

          .subscriptions-tools {
            align-items: stretch;
          }

          .subscriptions-filters {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
