"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BGButton, BGCard, BGEmptyState, BGPageHeader, BGPageShell, BGStatCard, BGStatusBadge } from "@/components/bodygate-ui";
import { adaptDashboardOverview } from "@/architecture/platinum-runtime-adapters";

type DashboardAccessItem = {
  id?: string | number | null;
  allowed?: boolean | null;
  created_at?: string | null;
  display_name?: string | null;
  customer_name?: string | null;
  staff_name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  controller_code?: string | null;
  badge_code?: string | null;
  was_allowed?: boolean | null;
  reason?: string | null;
  access_time?: string | null;
};

type DashboardAlertItem = {
  id?: string | number | null;
  customer_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  customer_id?: string | null;
  ends_at?: string | null;
  medical_certificate_end?: string | null;
};

type DashboardOverview = {
  ok: boolean;
  generated_at: string;
  kpis: {
    active_customers: number;
    accesses_today: number;
    denied_today: number;
    revenue_today: number;
    revenue_month: number;
    active_blocks: number;
  };
  bridge: {
    status: string;
    last_seen_at: string | null;
    raw: unknown;
  };
  alerts: {
    expired_medical: DashboardAlertItem[];
    expiring_medical: DashboardAlertItem[];
    expired_subscriptions: DashboardAlertItem[];
    expiring_subscriptions: DashboardAlertItem[];
  };
  latest_access: DashboardAccessItem[];
};

function euro(value: number | null) {
  if (value === null) return "Dato non disponibile";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function accessPersonName(item: DashboardAccessItem) {
  return (
    item.display_name ||
    item.customer_name ||
    item.staff_name ||
    item.full_name ||
    `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
    `Codice: ${item.controller_code || item.badge_code || "—"}`
  );
}

function BGQuickActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  const visualIcon = title.slice(0, 1).toUpperCase() || icon;

  return (
    <Link href={href} className="quick-card">
      <span className="quick-card-icon">{visualIcon}</span>
      <span className="quick-card-title">{title}</span>
      <span className="quick-card-description">{description}</span>
    </Link>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadDashboard() {
    try {
      setErrorMessage("");
      const res = await fetch("/api/dashboard/overview", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Errore caricamento dashboard.");
      }

      setData(json);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadDashboard);
    const timer = setInterval(loadDashboard, 30000);
    return () => clearInterval(timer);
  }, []);

  const bridgeStatus = data?.bridge?.status || "unknown";
  const bridgeOnline = bridgeStatus === "online" || bridgeStatus === "ok";
  const view = useMemo(() => adaptDashboardOverview(data), [data]);
  const display = (value: string | number | null) => value ?? "Dato non disponibile";
  const alertLists = {
    expiredMedical: Array.isArray(data?.alerts?.expired_medical) ? data.alerts.expired_medical : null,
    expiringMedical: Array.isArray(data?.alerts?.expiring_medical) ? data.alerts.expiring_medical : null,
    expiredSubscriptions: Array.isArray(data?.alerts?.expired_subscriptions) ? data.alerts.expired_subscriptions : null,
    expiringSubscriptions: Array.isArray(data?.alerts?.expiring_subscriptions) ? data.alerts.expiring_subscriptions : null,
  };
  const alertsComplete = Object.values(view.alertCounts).every(value => value !== null) && view.kpis.activeBlocks !== null;
  const totalAlerts = alertsComplete
    ? Object.values(view.alertCounts).reduce<number>((total, value) => total + (value ?? 0), view.kpis.activeBlocks ?? 0)
    : null;
  const latestAccess = Array.isArray(data?.latest_access) ? data.latest_access : null;

  return (
    <main className="command-page-v2">
      <style jsx global>{`
        .command-page-v2 {
          min-height: 100vh;
          padding: 26px;
          color: #fff;
          background:
            radial-gradient(circle at top left, rgba(239, 68, 68, 0.22), transparent 30%),
            radial-gradient(circle at 75% 0%, rgba(255,255,255,.08), transparent 24%),
            linear-gradient(135deg, #050505, #0a0a0a 46%, #111);
        }

        .top-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .runtime-kpi > div > div:nth-child(2) {
          overflow-wrap: anywhere;
        }

        .runtime-kpi[data-missing="true"] > div > div:nth-child(2) {
          font-size: clamp(1.15rem, 1.55vw, 1.65rem);
          line-height: 1.15;
        }

        .command-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.04fr) minmax(0, .96fr);
          gap: 18px;
          align-items: start;
        }

        .command-column {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .panel-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 16px;
        }

        .panel-title {
          font-size: 21px;
          font-weight: 950;
          letter-spacing: -.04em;
        }

        .alert-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .alert-tile {
          min-height: 124px;
          border-radius: 22px;
          padding: 18px;
          border: 1px solid rgba(255,255,255,.09);
          background: rgba(255,255,255,.035);
        }

        .alert-tile.danger {
          border-color: rgba(239,68,68,.34);
          background: radial-gradient(circle at top right, rgba(239,68,68,.22), transparent 55%), rgba(255,255,255,.035);
        }

        .alert-tile.warning {
          border-color: rgba(250,204,21,.27);
          background: radial-gradient(circle at top right, rgba(250,204,21,.20), transparent 55%), rgba(255,255,255,.035);
        }

        .alert-number {
          font-size: 38px;
          line-height: .95;
          font-weight: 950;
          letter-spacing: -.06em;
        }

        .alert-label {
          margin-top: 10px;
          color: #cfcfcf;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 800;
        }

        .access-list,
        .deadline-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .access-item {
          display: grid;
          grid-template-columns: 12px 1fr auto;
          align-items: center;
          gap: 12px;
          border-radius: 18px;
          padding: 14px;
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.075);
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #737373;
          box-shadow: 0 0 16px currentColor;
        }

        .dot.ok {
          background: #22c55e;
          color: #22c55e;
        }

        .dot.no {
          background: #ef4444;
          color: #ef4444;
        }

        .access-title {
          font-weight: 950;
          font-size: 13px;
          color: #fff;
        }

        .access-sub {
          margin-top: 4px;
          color: #8c8c8c;
          font-size: 12px;
          line-height: 1.35;
        }

        .quick-actions-panel {
          border-color: rgba(239, 68, 68, 0.18);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,.16), transparent 42%),
            linear-gradient(145deg, rgba(255,255,255,.075), rgba(255,255,255,.022)),
            rgba(8,8,8,.9);
        }

        .quick-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .quick-card {
          min-height: 132px;
          display: grid;
          gap: 10px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 8px;
          padding: 16px;
          color: #fff;
          text-decoration: none;
          text-decoration-line: none;
          background: rgba(255, 255, 255, 0.04);
          transition:
            border-color 150ms ease,
            background 150ms ease,
            transform 150ms ease;
        }

        .quick-card:link,
        .quick-card:visited,
        .quick-card:hover,
        .quick-card:active {
          color: #fff;
          text-decoration: none;
        }

        .quick-card:focus-visible {
          outline: 2px solid rgba(239, 68, 68, 0.72);
          outline-offset: 3px;
        }

        .quick-card:hover {
          transform: translateY(-1px);
          border-color: rgba(239, 68, 68, 0.48);
          background: rgba(239, 68, 68, 0.1);
        }

        .quick-card-icon {
          width: 34px;
          height: 34px;
          display: inline-grid;
          place-items: center;
          border: 1px solid rgba(239, 68, 68, 0.28);
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.12);
          color: #fca5a5;
          font-weight: 950;
        }

        .quick-card-title {
          display: block;
          color: #fff;
          font-size: 15px;
          font-weight: 950;
        }

        .quick-card-description {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.45;
        }

        .error {
          border-radius: 22px;
          padding: 18px;
          border: 1px solid rgba(239,68,68,.38);
          background: rgba(239,68,68,.1);
          color: #fecaca;
          margin-bottom: 18px;
        }

        .loading {
          border-radius: 22px;
          padding: 22px;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.1);
          color: #ddd;
        }

        @media (max-width: 1220px) {
          .kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .command-grid {
            grid-template-columns: 1fr;
          }

          .alert-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .command-page-v2 {
            padding: 14px;
          }

          .kpi-grid,
          .alert-grid,
          .quick-grid {
            grid-template-columns: 1fr;
          }

          .access-item {
            grid-template-columns: 12px 1fr;
          }
        }
      `}</style>

      <BGPageShell>
      <BGPageHeader
        eyebrow="BodyGate Command Center"
        title="Controllo palestra in tempo reale."
        subtitle="Accessi, incassi, scadenze, alert e stato sistema in una schermata unica, pensata per reception e direzione."
        actions={
          <div className="top-actions">
            <BGStatusBadge tone={bridgeOnline ? "success" : "danger"}>
              {bridgeOnline ? "Bridge online" : "Bridge non rilevato"}
            </BGStatusBadge>
            <BGButton onClick={loadDashboard} variant="secondary">
              Aggiorna
            </BGButton>
          </div>
        }
      />

      {loading && <div className="loading" role="status">In aggiornamento</div>}
      {errorMessage && <div className="error" role="alert">{errorMessage} <BGButton variant="secondary" onClick={loadDashboard}>Riprova</BGButton></div>}

      {!loading && data && (
        <>
          <section className="kpi-grid">
            <BGStatCard className="runtime-kpi" data-missing={view.kpis.activeCustomers === null} label="Clienti attivi" value={display(view.kpis.activeCustomers)} note="Anagrafiche operative" />
            <BGStatCard className="runtime-kpi" data-missing={view.kpis.accessesToday === null} label="Accessi oggi" value={display(view.kpis.accessesToday)} note="Ingressi registrati" tone="green" />
            <BGStatCard className="runtime-kpi" data-missing={view.kpis.deniedToday === null} label="Negati oggi" value={display(view.kpis.deniedToday)} note="Accessi da monitorare" tone={(view.kpis.deniedToday ?? 0) > 0 ? "red" : "neutral"} />
            <BGStatCard className="runtime-kpi" data-missing={view.kpis.revenueToday === null} label="Incassi oggi" value={euro(view.kpis.revenueToday)} note="Pagamenti registrati" tone="green" />
            <BGStatCard className="runtime-kpi" data-missing={view.kpis.revenueMonth === null} label="Incassi mese" value={euro(view.kpis.revenueMonth)} note="Mese corrente" tone="blue" />
            <BGStatCard className="runtime-kpi" data-missing={view.kpis.activeBlocks === null} label="Blocchi attivi" value={display(view.kpis.activeBlocks)} note="Clienti da verificare" tone={(view.kpis.activeBlocks ?? 0) > 0 ? "red" : "neutral"} />
          </section>

          <section className="command-grid">
            <div className="command-column">
              <BGCard>
              <div className="panel-title-row">
                <div className="panel-title">Alert operativi</div>
                <BGStatusBadge tone={totalAlerts === null || totalAlerts > 0 ? "warning" : "success"}>
                  {totalAlerts === null ? "Da verificare" : totalAlerts > 0 ? `${totalAlerts} alert` : "Tutto ok"}
                </BGStatusBadge>
              </div>

              <div className="alert-grid">
                <div className="alert-tile danger">
                  <div className="alert-number">{display(view.alertCounts.expiredMedical)}</div>
                  <div className="alert-label">Certificati scaduti</div>
                </div>
                <div className="alert-tile warning">
                  <div className="alert-number">{display(view.alertCounts.expiringMedical)}</div>
                  <div className="alert-label">Certificati in scadenza</div>
                </div>
                <div className="alert-tile danger">
                  <div className="alert-number">{display(view.alertCounts.expiredSubscriptions)}</div>
                  <div className="alert-label">Abbonamenti scaduti</div>
                </div>
                <div className="alert-tile warning">
                  <div className="alert-number">{display(view.alertCounts.expiringSubscriptions)}</div>
                  <div className="alert-label">Abbonamenti in scadenza</div>
                </div>
              </div>
            </BGCard>

              <BGCard>
              <div className="panel-title-row">
                <div className="panel-title">Ultimi accessi</div>
                <BGStatusBadge tone="info">Live log</BGStatusBadge>
              </div>

              <div className="access-list">
                {latestAccess === null ? <BGEmptyState title="Dato non disponibile" description="Gli accessi recenti non sono presenti nella risposta." /> : latestAccess.length === 0 && (
                  <BGEmptyState
                    title="Nessun accesso recente"
                    description="Gli ingressi appariranno qui appena registrati."
                  />
                )}

                {(latestAccess ?? []).map((item) => (
                  <div className="access-item" key={item.id || `${item.created_at}-${accessPersonName(item)}`}>
                    <span className={`dot ${item.allowed ? "ok" : "no"}`} />

                    <div>
                      <div className="access-title">
                        {item.allowed ? "Accesso consentito" : "Accesso negato"}
                      </div>

                      <div className="access-sub">
                        {accessPersonName(item)}
                        {" · "}
                        {item.reason || "Nessun motivo"}
                      </div>
                    </div>

                    <div className="access-sub">{dateTime(item.created_at)}</div>
                  </div>
                ))}
              </div>
            </BGCard>
            </div>

            <div className="command-column">
              <BGCard className="quick-actions-panel">
              <div className="panel-title-row">
                <div>
                  <div className="panel-title">Azioni rapide</div>
                </div>
                <BGStatusBadge tone="info">Reception</BGStatusBadge>
              </div>

              <div className="quick-grid bg-actions-grid">
                <BGQuickActionCard
                  href="/reception"
                  icon="reception"
                  title="Reception Desk"
                  description="Cliente rapido, accessi e operatività giornaliera."
                />
                <BGQuickActionCard
                  href="/customers/new"
                  icon="customer"
                  title="Nuovo cliente"
                  description="Crea anagrafica, contatti e dati iniziali."
                />
                <BGQuickActionCard
                  href="/payments"
                  icon="payment"
                  title="Nuovo incasso"
                  description="Registra pagamenti, rinnovi e ricevute."
                />
                <BGQuickActionCard
                  href="/notifications"
                  icon="notification"
                  title="Notification Center"
                  description="Scadenze, blocchi e alert da lavorare."
                />
                <BGQuickActionCard
                  href="/access-control"
                  icon="access"
                  title="Access Control"
                  description="Hub debug, audit credenziali e registro accessi."
                />
                <BGQuickActionCard
                  href="/system/staff"
                  icon="staff"
                  title="Staff"
                  description="Ruoli, stato operatori e invio Staff Mobile Pass."
                />
              </div>
            </BGCard>

              <BGCard>
              <div className="panel-title-row">
                <div className="panel-title">Scadenze imminenti</div>
                <BGStatusBadge tone="warning">15 giorni</BGStatusBadge>
              </div>

              <div className="deadline-list">
                {alertLists.expiringSubscriptions === null || alertLists.expiringMedical === null ? (
                  <BGEmptyState title="Dato non disponibile" description="Le scadenze non sono presenti nella risposta." />
                ) : alertLists.expiringSubscriptions.length === 0 &&
                  alertLists.expiringMedical.length === 0 && (
                    <BGEmptyState
                      title="Nessuna scadenza imminente"
                      description="Abbonamenti e certificati risultano sotto controllo."
                    />
                  )}

                {(alertLists.expiringSubscriptions ?? []).map((item) => {
                  const customerName =
                    item.customer_name ||
                    `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
                    item.customer_id;

                  const expiryDate = item.ends_at
                    ? new Date(item.ends_at).toLocaleDateString("it-IT")
                    : "—";

                  return (
                    <div className="access-item" key={`sub-${item.id}`}>
                      <span className="dot no" />
                      <div>
                        <div className="access-title">Abbonamento in scadenza</div>
                        <div className="access-sub">
                          Cliente: {customerName} · Scade: {expiryDate}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(alertLists.expiringMedical ?? []).map((item) => (
                  <div className="access-item" key={`med-${item.id}`}>
                    <span className="dot no" />
                    <div>
                      <div className="access-title">Certificato in scadenza</div>
                      <div className="access-sub">
                        {item.first_name} {item.last_name} · Scade:{" "}
                        {item.medical_certificate_end}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </BGCard>
            </div>
          </section>
        </>
      )}
      </BGPageShell>
    </main>
  );
}
