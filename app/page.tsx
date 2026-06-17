"use client";

import { useEffect, useMemo, useState } from "react";
import BGButton from "./components/ui/BGButton";
import BGCard from "./components/ui/BGCard";
import BGEmptyState from "./components/ui/BGEmptyState";
import BGPageHeader from "./components/ui/BGPageHeader";
import BGQuickActionCard from "./components/ui/BGQuickActionCard";
import BGStatCard from "./components/ui/BGStatCard";
import BGStatusBadge from "./components/ui/BGStatusBadge";
import { BGErrorState, BGOperationalRow, BGPageContainer, BGSkeleton, BGToolbar } from "./components/ui/BGPrimitives";
import { bgFetchJson } from "./lib/clientFetch";

type DashboardAccessItem = { id?: string | number | null; allowed?: boolean | null; created_at?: string | null; display_name?: string | null; customer_name?: string | null; staff_name?: string | null; full_name?: string | null; first_name?: string | null; last_name?: string | null; controller_code?: string | null; badge_code?: string | null; reason?: string | null };
type DashboardAlertItem = { id?: string | number | null; customer_name?: string | null; first_name?: string | null; last_name?: string | null; customer_id?: string | null; ends_at?: string | null; medical_certificate_end?: string | null };
type DashboardOverview = { ok: boolean; generated_at: string; kpis: { active_customers: number; accesses_today: number; denied_today: number; revenue_today: number; revenue_month: number; active_blocks: number }; bridge: { status: string; last_seen_at: string | null; raw: unknown }; alerts: { expired_medical: DashboardAlertItem[]; expiring_medical: DashboardAlertItem[]; expired_subscriptions: DashboardAlertItem[]; expiring_subscriptions: DashboardAlertItem[] }; latest_access: DashboardAccessItem[] };

function euro(value: number) { return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0); }
function dateTime(value?: string | null) { if (!value) return "—"; return new Date(value).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function accessPersonName(item: DashboardAccessItem) { return item.display_name || item.customer_name || item.staff_name || item.full_name || `${item.first_name || ""} ${item.last_name || ""}`.trim() || `Codice ${item.controller_code || item.badge_code || "non disponibile"}`; }
function customerName(item: DashboardAlertItem) { return item.customer_name || `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.customer_id || "Cliente da verificare"; }

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadDashboard(mode: "initial" | "refresh" = "refresh") {
    if (mode === "refresh" && data) setRefreshing(true);
    setErrorMessage("");
    const result = await bgFetchJson<DashboardOverview>("/api/dashboard/overview", { cache: "no-store", timeoutMs: 9000, retries: 1, userMessage: "Command Center non aggiornato. Manteniamo i dati già visualizzati." });
    if (!result.ok) setErrorMessage(result.userMessage);
    else if (!result.data?.ok) setErrorMessage("Command Center non disponibile. Riprova tra poco.");
    else setData(result.data);
    setInitialLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { void loadDashboard("initial"); const timer = window.setInterval(() => void loadDashboard("refresh"), 30000); return () => window.clearInterval(timer); }, []);

  const totalAlerts = useMemo(() => data ? data.alerts.expired_medical.length + data.alerts.expiring_medical.length + data.alerts.expired_subscriptions.length + data.alerts.expiring_subscriptions.length + data.kpis.active_blocks + data.kpis.denied_today : 0, [data]);
  const bridgeOnline = data?.bridge?.status === "online" || data?.bridge?.status === "ok";

  return (
    <BGPageContainer className="command-page-v3">
      <BGPageHeader
        eyebrow="BodyGate Command Center"
        title="Controllo operativo palestra"
        subtitle="Stato sistema, accessi, incassi, scadenze e priorità in una schermata unica per reception e amministrazione."
        actions={<BGToolbar><BGStatusBadge tone={bridgeOnline ? "success" : data ? "danger" : "warning"}>{data ? (bridgeOnline ? "Bridge online" : "Bridge da verificare") : "Da verificare"}</BGStatusBadge><BGButton onClick={() => loadDashboard("refresh")} variant="secondary" disabled={refreshing}>{refreshing ? "Aggiorno…" : "Aggiorna"}</BGButton></BGToolbar>}
      />

      {initialLoading && <BGCard><BGSkeleton lines={6} /></BGCard>}
      {errorMessage && <BGErrorState title="Dashboard non aggiornata" description={errorMessage} action={<BGButton onClick={() => loadDashboard(data ? "refresh" : "initial")} variant="secondary">Riprova</BGButton>} />}

      {data && (
        <>
          <section className="command-kpi-grid">
            <BGStatCard label="Clienti attivi" value={data.kpis.active_customers} note="Apri CRM Clienti" tone="blue" />
            <BGStatCard label="Accessi oggi" value={data.kpis.accesses_today} note="Vai ad Accessi" tone="green" />
            <BGStatCard label="Incassi oggi" value={euro(data.kpis.revenue_today)} note="Vai a Pagamenti" tone="green" />
            <BGStatCard label="Criticità" value={totalAlerts} note="Priorità operative" tone={totalAlerts > 0 ? "red" : "neutral"} />
          </section>

          <section className="command-grid-v3">
            <BGCard>
              <BGToolbar><h2 className="bg-card-title-reset">Priorità operative</h2><BGStatusBadge tone={totalAlerts > 0 ? "warning" : "success"}>{totalAlerts > 0 ? `${totalAlerts} da lavorare` : "Nessuna criticità"}</BGStatusBadge></BGToolbar>
              <div className="command-priority-grid">
                <BGQuickActionCard href="/customers?filter=medical_expired" title={`${data.alerts.expired_medical.length} certificati scaduti`} description="Apri Clienti filtrati" icon="M" />
                <BGQuickActionCard href="/subscriptions?filter=expired" title={`${data.alerts.expired_subscriptions.length} abbonamenti scaduti`} description="Apri Abbonamenti" icon="A" />
                <BGQuickActionCard href="/access-control?filter=denied_today" title={`${data.kpis.denied_today} accessi negati`} description="Controlla motivi" icon="!" />
                <BGQuickActionCard href="/customers?filter=blocks" title={`${data.kpis.active_blocks} blocchi attivi`} description="Verifica blocchi" icon="B" />
              </div>
            </BGCard>

            <BGCard className="quick-actions-panel">
              <BGToolbar><h2 className="bg-card-title-reset">Azioni rapide</h2><BGStatusBadge tone="info">Operative</BGStatusBadge></BGToolbar>
              <div className="quick-grid bg-actions-grid">
                <BGQuickActionCard href="/reception" icon="R" title="Reception" description="Cerca cliente e lavora gli accessi." />
                <BGQuickActionCard href="/customers/new" icon="+" title="Nuovo cliente" description="Onboarding operativo." />
                <BGQuickActionCard href="/payments" icon="€" title="Pagamenti" description="Incassi e ricevute." />
                <BGQuickActionCard href="/access-control" icon="G" title="Accessi" description="Feed, debug e credenziali." />
              </div>
            </BGCard>

            <BGCard>
              <BGToolbar><h2 className="bg-card-title-reset">Accessi recenti</h2><BGStatusBadge tone="info">Ultimi eventi</BGStatusBadge></BGToolbar>
              {data.latest_access.length === 0 ? <BGEmptyState title="Nessun accesso recente" description="Gli ingressi appariranno qui appena registrati." /> : <div className="bg-data-list">{data.latest_access.map((item) => <BGOperationalRow key={item.id || `${item.created_at}-${accessPersonName(item)}`} title={item.allowed ? "Accesso consentito" : "Accesso bloccato"} meta={`${accessPersonName(item)} · ${item.reason || "Motivo non indicato"} · ${dateTime(item.created_at)}`} status={<BGStatusBadge tone={item.allowed ? "success" : "danger"}>{item.allowed ? "OK" : "Negato"}</BGStatusBadge>} />)}</div>}
            </BGCard>

            <BGCard>
              <BGToolbar><h2 className="bg-card-title-reset">Scadenze prossime</h2><BGStatusBadge tone="warning">15 giorni</BGStatusBadge></BGToolbar>
              {data.alerts.expiring_subscriptions.length === 0 && data.alerts.expiring_medical.length === 0 ? <BGEmptyState title="Nessuna scadenza imminente" description="Abbonamenti e certificati risultano sotto controllo." /> : <div className="bg-data-list">{data.alerts.expiring_subscriptions.map((item) => <BGOperationalRow key={`sub-${item.id}`} title="Abbonamento in scadenza" meta={`${customerName(item)} · ${item.ends_at ? new Date(item.ends_at).toLocaleDateString("it-IT") : "Data non disponibile"}`} status={<BGStatusBadge tone="warning">Scadenza</BGStatusBadge>} />)}{data.alerts.expiring_medical.map((item) => <BGOperationalRow key={`med-${item.id}`} title="Certificato in scadenza" meta={`${customerName(item)} · ${item.medical_certificate_end || "Data non disponibile"}`} status={<BGStatusBadge tone="warning">Certificato</BGStatusBadge>} />)}</div>}
            </BGCard>
          </section>
        </>
      )}
    </BGPageContainer>
  );
}
