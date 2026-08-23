"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { BGButton, BGCard, BGEmptyState, BGInput, BGPageHeader, BGStatCard, BGStatusBadge } from "@/components/bodygate-ui";
import { adaptReceptionCustomer } from "@/architecture/platinum-runtime-adapters";

type Customer = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  is_active?: boolean | null;
  medical_certificate_start_date?: string | null;
  medical_certificate_end_date?: string | null;
  medical_certificate_status?: string | null;
  medical_certificate_start?: string | null;
  medical_certificate_end?: string | null;
};

type CustomerName = {
  first_name?: string | null;
  last_name?: string | null;
};

type AccessLog = {
  id: string;
  created_at: string;
  access_time?: string | null;
  customer_id: string | null;
  badge_code: string | null;
  controller_code: string | null;
  was_allowed?: boolean | null;
  allowed?: boolean | null;
  reason: string | null;
  customers?: CustomerName | CustomerName[] | null;
};

type GymPresence = {
  id: string;
  customer_id: string;
  badge_code: string | null;
  is_inside: boolean | null;
  updated_at: string;
};

type ReceptionAlert = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  suggestedAction: string;
  time: string;
  badgeOrCustomer: string;
};

type BridgeWatchdog = {
  state: "online" | "degraded" | "offline";
  process_active: boolean | null;
  last_error: string | null;
  checked_at?: string;
};

type SubscriptionAlert = {
  id: string;
  customer_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
  customers?: CustomerName | CustomerName[] | null;
};

type BridgeStatus = {
  online: boolean;
  connected: boolean;
  processing: boolean;
  lastBadge: string | null;
  lastBadgeTime: string | null;
  checkedAt: string | null;
  error: string | null;
};

export default function ReceptionDashboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [certificates, setCertificates] = useState<Customer[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionAlert[]>([]);
  const [gymPresence, setGymPresence] = useState<GymPresence[]>([]);

  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({
    online: false,
    connected: false,
    processing: false,
    lastBadge: null,
    lastBadgeTime: null,
    checkedAt: null,
    error: null,
  });

  const [bridgeWatchdog, setBridgeWatchdog] = useState<BridgeWatchdog>({
    state: "offline",
    process_active: null,
    last_error: null,
  });

  const [bridgeLoading, setBridgeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  function normalizeCustomerName(item?: CustomerName | CustomerName[] | null) {
    const customer = Array.isArray(item) ? item[0] : item;
    if (!customer) return "Cliente";

    return (
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      "Cliente"
    );
  }

  function getName(item?: CustomerName | CustomerName[] | null) {
    return normalizeCustomerName(item);
  }

  function isAllowed(log: AccessLog) {
    return Boolean(log.was_allowed ?? log.allowed);
  }

  function todayString() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  const loadData = useCallback(async () => {
    setLoading(true);

    const today = todayString();
    const in30Days = addDays(30);

    const [
      { data: customersData, error: customersError },
      { data: logsData, error: logsError },
      { data: certificatesData, error: certificatesError },
      { data: subscriptionsData, error: subscriptionsError },
      { data: gymPresenceData, error: presenceError },
    ] = await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, first_name, last_name, is_active, medical_certificate_start_date, medical_certificate_end_date, medical_certificate_status, medical_certificate_start, medical_certificate_end",
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("customer_access_logs")
        .select(
          `
          id,
          created_at,
          access_time,
          customer_id,
          badge_code,
          controller_code,
          was_allowed,
          reason,
          customers (
            first_name,
            last_name
          )
        `,
        )
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(120),

      supabase
        .from("customers")
        .select(
          "id, first_name, last_name, is_active, medical_certificate_start_date, medical_certificate_end_date, medical_certificate_status, medical_certificate_start, medical_certificate_end",
        )
        .eq("is_active", true)
        .gte("medical_certificate_end_date", today)
        .lte("medical_certificate_end_date", in30Days)
        .order("medical_certificate_end_date", { ascending: true })
        .limit(20),

      supabase
        .from("customer_subscriptions")
        .select(
          `
          id,
          customer_id,
          starts_at,
          ends_at,
          is_active,
          customers (
            first_name,
            last_name
          )
        `,
        )
        .eq("is_active", true)
        .lte("ends_at", in30Days)
        .order("ends_at", { ascending: true })
        .limit(120),

      supabase
        .from("gym_presence")
        .select("id, customer_id, badge_code, is_inside, updated_at")
        .order("updated_at", { ascending: false })
        .limit(120),
    ]);

    const firstError = customersError || logsError || certificatesError || subscriptionsError || presenceError;
    setDataError(firstError?.message || "");
    setCustomers((customersData || []) as Customer[]);
    setLogs((logsData || []) as AccessLog[]);
    setCertificates((certificatesData || []) as Customer[]);
    setSubscriptions((subscriptionsData || []) as SubscriptionAlert[]);
    setGymPresence((gymPresenceData || []) as GymPresence[]);
    setLoading(false);
  }, []);

  async function loadBridgeStatus() {
    setBridgeLoading(true);
    try {
      const res = await fetch("/api/bridge/status", { cache: "no-store" });
      const data = await res.json();
      const bridge = data?.bridge ?? {};

      setBridgeStatus({
        online: Boolean(data?.online),
        connected:
          typeof data?.connected === "boolean"
            ? data.connected
            : Boolean(bridge?.connected),
        processing:
          typeof data?.processing === "boolean"
            ? data.processing
            : Boolean(bridge?.processing),
        lastBadge:
          data?.lastBadge ?? bridge?.lastBadge ?? bridge?.last_badge ?? null,
        lastBadgeTime:
          data?.lastBadgeTime ??
          bridge?.lastBadgeTime ??
          bridge?.last_badge_time ??
          null,
        checkedAt: data?.checked_at ?? new Date().toISOString(),
        error: data?.error ?? null,
      });

      setBridgeWatchdog({
        state: data?.watchdog?.state || (data?.online ? "online" : "offline"),
        process_active: data?.watchdog?.process_active ?? null,
        last_error: data?.watchdog?.last_error ?? data?.error ?? null,
        checked_at: data?.checked_at,
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Errore connessione bridge";

      setBridgeStatus({
        online: false,
        connected: false,
        processing: false,
        lastBadge: null,
        lastBadgeTime: null,
        checkedAt: new Date().toISOString(),
        error: msg,
      });

      setBridgeWatchdog({
        state: "offline",
        process_active: null,
        last_error: msg,
        checked_at: new Date().toISOString(),
      });
    } finally {
      setBridgeLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
      loadBridgeStatus();
    });

    const bridgeInterval = window.setInterval(() => {
      loadBridgeStatus();
    }, 5000);

    const channel = supabase
      .channel("reception_dashboard_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "access_logs" },
        () => loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers" },
        () => loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_subscriptions" },
        () => loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_access_logs" },
        () => loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gym_presence" },
        () => loadData(),
      )
      .subscribe();

    return () => {
      window.clearInterval(bridgeInterval);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const stats = useMemo(() => {
    const today = todayString();

    const accessToday = logs.filter(isAllowed).length;
    const deniedToday = logs.filter((log) => !isAllowed(log)).length;

    const expiredSubscriptions = subscriptions.filter((subscription) => {
      const expiry = subscription.ends_at
        ? String(subscription.ends_at).slice(0, 10)
        : null;
      return (
        Boolean(subscription.is_active) && Boolean(expiry) && expiry! < today
      );
    }).length;

    const blockedCustomers = customers.filter(
      (customer) => customer.is_active === false,
    ).length;

    const latestDenied = logs.find((log) => !isAllowed(log));

    return {
      accessToday,
      deniedToday,
      certificatesExpiring: certificates.length,
      expiredSubscriptions,
      blockedCustomers,
      latestDenied,
    };
  }, [customers, logs, certificates, subscriptions]);

  const receptionAlerts = useMemo<ReceptionAlert[]>(() => {
    const items: ReceptionAlert[] = [];
    const now = new Date().toISOString();

    const latestDenied = logs.find((log) => !isAllowed(log));
    const insideNow = gymPresence.filter((p) => p.is_inside).length;

    if (!bridgeStatus.online || bridgeWatchdog.state === "offline") {
      items.push({
        id: "bridge-offline",
        type: "Bridge offline",
        severity: "critical",
        message:
          "Bridge non raggiungibile: il tornello non può autorizzare accessi in modo affidabile.",
        suggestedAction:
          "Verifica servizio bridge su Windows e connettività rete verso controller.",
        time: bridgeWatchdog.checked_at || bridgeStatus.checkedAt || now,
        badgeOrCustomer: bridgeStatus.lastBadge || "N/A",
      });
    }

    if (
      bridgeWatchdog.state === "degraded" ||
      (bridgeStatus.online && !bridgeStatus.connected)
    ) {
      items.push({
        id: "bridge-degraded",
        type: "Bridge degraded",
        severity: "warning",
        message: "Bridge online ma centralina non connessa stabilmente.",
        suggestedAction:
          "Controlla cablaggio/IP controller e rilancia health check.",
        time: bridgeWatchdog.checked_at || bridgeStatus.checkedAt || now,
        badgeOrCustomer: bridgeStatus.lastBadge || "N/A",
      });
    }

    const unknownBadge = logs.find(
      (log) =>
        !isAllowed(log) && (log.reason || "").toLowerCase().includes("badge"),
    );
    if (unknownBadge) {
      items.push({
        id: "unknown-badge",
        type: "Badge sconosciuto",
        severity: "critical",
        message: "Rilevato badge non associato a nessun cliente.",
        suggestedAction:
          "Identifica la persona e registra/assegna badge corretto.",
        time: unknownBadge.created_at,
        badgeOrCustomer: unknownBadge.badge_code || "Badge non disponibile",
      });
    }

    const pushByReason = (
      id: string,
      type: string,
      lookups: string[],
      action: string,
    ) => {
      const target = logs.find(
        (log) =>
          !isAllowed(log) &&
          lookups.some((lk) => (log.reason || "").toLowerCase().includes(lk)),
      );
      if (!target) return;
      const customerName = target.customers
        ? getName(target.customers)
        : "Cliente non associato";
      items.push({
        id,
        type,
        severity: "warning",
        message: `${type} rilevato su controllo accesso.`,
        suggestedAction: action,
        time: target.created_at,
        badgeOrCustomer: `${customerName} • ${target.badge_code || "Badge -"}`,
      });
    };

    pushByReason(
      "expired-sub",
      "Accesso negato: abbonamento",
      ["abbon", "subscription"],
      "Invita il cliente al rinnovo o attiva nuovo abbonamento.",
    );
    pushByReason(
      "expired-cert",
      "Accesso negato: certificato medico",
      ["certificat", "medical"],
      "Richiedi certificato valido e aggiorna anagrafica.",
    );
    pushByReason(
      "missing-fee",
      "Accesso negato: quota associativa",
      ["quota", "membership"],
      "Regolarizza quota associativa prima del nuovo accesso.",
    );

    const blocked = logs.find(
      (log) =>
        !isAllowed(log) && (log.reason || "").toLowerCase().includes("blocc"),
    );
    if (blocked) {
      const customerName = blocked.customers
        ? getName(blocked.customers)
        : "Cliente bloccato";
      items.push({
        id: "blocked-customer",
        type: "Cliente bloccato",
        severity: "critical",
        message: "Accesso negato a cliente marcato come bloccato/non attivo.",
        suggestedAction:
          "Controlla motivazione blocco e autorizzazioni amministrative.",
        time: blocked.created_at,
        badgeOrCustomer: `${customerName} • ${blocked.badge_code || "Badge -"}`,
      });
    }

    const deniedMap = new Map<string, { count: number; latest: string }>();
    logs
      .filter((log) => !isAllowed(log))
      .forEach((log) => {
        const key = log.customer_id || log.badge_code || "unknown";
        const current = deniedMap.get(key) || {
          count: 0,
          latest: log.created_at,
        };
        current.count += 1;
        if (new Date(log.created_at) > new Date(current.latest))
          current.latest = log.created_at;
        deniedMap.set(key, current);
      });
    const repeat = [...deniedMap.entries()].find(([, v]) => v.count >= 3);
    if (repeat) {
      items.push({
        id: "repeat-denied",
        type: "Accessi negati ripetuti",
        severity: "critical",
        message: `Rilevati ${repeat[1].count} accessi negati ripetuti sullo stesso badge/cliente oggi.`,
        suggestedAction:
          "Contatta subito la reception desk per verifica identità e posizione amministrativa.",
        time: repeat[1].latest,
        badgeOrCustomer: repeat[0],
      });
    }

    if (latestDenied && items.length === 0) {
      items.push({
        id: "generic-denied",
        type: "Accesso negato",
        severity: "info",
        message:
          "È presente almeno un accesso negato, senza pattern critici configurati.",
        suggestedAction:
          "Apri il registro accessi e verifica il motivo denial.",
        time: latestDenied.created_at,
        badgeOrCustomer: latestDenied.badge_code || "Badge -",
      });
    }

    if (!latestDenied && items.length === 0) {
      items.push({
        id: "ops-ok",
        type: "Reception regolare",
        severity: "info",
        message: `Nessuna anomalia critica. Presenti in palestra: ${insideNow}.`,
        suggestedAction: "Continuare monitoraggio live.",
        time: now,
        badgeOrCustomer: "-",
      });
    }

    return items
      .sort((a, b) => +new Date(b.time) - +new Date(a.time))
      .slice(0, 8);
  }, [bridgeStatus, bridgeWatchdog, logs, gymPresence]);

  const customerMatches = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("it-IT");
    if (!needle) return [];
    return customers.filter(customer => `${customer.first_name || ""} ${customer.last_name || ""}`.toLocaleLowerCase("it-IT").includes(needle)).slice(0, 8);
  }, [customers, search]);
  const selectedCustomer = useMemo(() => adaptReceptionCustomer(customers.find(customer => customer.id === selectedCustomerId), subscriptions), [customers, selectedCustomerId, subscriptions]);

  function systemStatusLabel(state: BridgeWatchdog["state"]) {
    if (state === "online") return "Sistema operativo";
    if (state === "degraded") return "Sistema degradato";
    return "Sistema critico";
  }

  function systemBadgeStyle(
    state: BridgeWatchdog["state"],
  ): React.CSSProperties {
    const color =
      state === "online"
        ? "#22c55e"
        : state === "degraded"
          ? "#f59e0b"
          : "#ef4444";
    return {
      background: `${color}22`,
      color,
      border: `1px solid ${color}66`,
      borderRadius: "999px",
      padding: "10px 14px",
      fontWeight: 800,
      fontSize: "13px",
      whiteSpace: "nowrap",
    };
  }

  return (
    <main className="reception-runtime" style={pageStyle}>
      <style jsx global>{`
        .reception-runtime,
        .reception-runtime > *,
        .reception-runtime .reception-panel,
        .reception-runtime .reception-panel > * {
          min-width: 0;
          max-width: 100%;
        }

        @media (max-width: 1100px) {
          .reception-runtime .reception-system-grid,
          .reception-runtime .reception-history-grid {
            grid-template-columns: 1fr !important;
          }

          .reception-runtime .reception-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 700px) {
          .reception-runtime .reception-panel-header {
            align-items: stretch !important;
            flex-direction: column;
          }

          .reception-runtime .reception-stats-grid,
          .reception-runtime .reception-customer-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .reception-runtime input {
            width: 100%;
          }
        }
      `}</style>
      <BGPageHeader
        eyebrow="BodyGate Reception"
        title="Reception live"
        subtitle="Console operativa realtime per monitorare ingressi, alert e clienti senza scritture DB dalla reception."
        actions={
          <>
            <BGStatusBadge
              tone={
                bridgeWatchdog.state === "online"
                  ? "success"
                  : bridgeWatchdog.state === "degraded"
                    ? "warning"
                    : "danger"
              }
            >
              {systemStatusLabel(bridgeWatchdog.state)}
            </BGStatusBadge>
            <BGButton
              variant="secondary"
              onClick={() => {
                loadData();
                loadBridgeStatus();
              }}
            >
              Aggiorna dashboard
            </BGButton>
            <BGStatusBadge tone="info">Polling live 5s</BGStatusBadge>
          </>
        }
      />

      <BGCard className="reception-panel">
        <div className="reception-panel-header" style={panelHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>1. Ricerca e identificazione cliente</h2>
            <p style={sectionTextStyle}>Cerca nei clienti già caricati. La selezione non modifica alcun dato.</p>
          </div>
          <BGInput aria-label="Ricerca cliente" placeholder="Nome o cognome" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        {search && customerMatches.length === 0 ? <BGEmptyState title="Nessun risultato" description="Verifica i termini di ricerca." /> : null}
        {customerMatches.length > 0 ? <div style={listStyle}>{customerMatches.map(customer => <button type="button" key={customer.id} onClick={() => setSelectedCustomerId(customer.id)} style={{...rowStyle, color: "inherit", cursor: "pointer", textAlign: "left", width: "100%"}}><strong>{`${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Dato non disponibile"}</strong><BGStatusBadge tone={customer.is_active === true ? "success" : customer.is_active === false ? "danger" : "warning"}>{customer.is_active === true ? "Attivo" : customer.is_active === false ? "Non attivo" : "Da verificare"}</BGStatusBadge></button>)}</div> : null}
        {selectedCustomer ? <div className="reception-customer-grid" style={{...gridStyle, marginTop: 16}}>
          <Card title="Cliente selezionato" value={selectedCustomer.name} note={selectedCustomer.activeLabel} />
          <Card title="Abbonamento" value={selectedCustomer.subscriptionExpiry ? new Date(selectedCustomer.subscriptionExpiry).toLocaleDateString("it-IT") : "Dato non disponibile"} note="Scadenza disponibile" />
          <Card title="Certificato medico" value={selectedCustomer.medicalExpiry ? new Date(selectedCustomer.medicalExpiry).toLocaleDateString("it-IT") : "Dato non disponibile"} note="Scadenza disponibile" />
          <Card title="Quota associativa" value="Da verificare" note="Dato non presente nel caricamento reception" />
          <Link href={`/customers/${selectedCustomer.id}`} style={rowLinkStyle}>Apri scheda cliente e azioni consentite</Link>
        </div> : null}
      </BGCard>

      {dataError ? <div role="alert" style={{...rowStyle, borderColor: "#ef4444", marginBottom: 16}}>API non disponibile: {dataError}<BGButton variant="secondary" onClick={loadData}>Riprova</BGButton></div> : null}

      <div className="reception-system-grid" style={firstRowStyle}>
        <BridgeStatusCard
          status={bridgeStatus}
          loading={bridgeLoading}
          watchdog={bridgeWatchdog}
          onRefresh={loadBridgeStatus}
        />
        {receptionAlerts.length > 0 ? (
          <ReceptionAlertsCard alerts={receptionAlerts} />
        ) : (
          <AlertCard
            title="Alert Reception"
            text="Nessuna anomalia critica attiva."
            tone="success"
          />
        )}
        <Card
          title="Presenti ora"
          value={String(gymPresence.filter((p) => p.is_inside).length)}
          note="Clienti attualmente in palestra"
        />
      </div>

      <div className="reception-history-grid" style={secondRowStyle}>
        <BGCard className="reception-panel">
          <div className="reception-panel-header" style={panelHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Accessi recenti</h2>
              <p style={sectionTextStyle}>
                Ultimi eventi dal tornello, aggiornati in tempo reale.
              </p>
            </div>

            <Link href="/access-logs" style={rowLinkStyle}>Apri registro</Link>
          </div>

          {loading ? (
            <BGEmptyState title="Caricamento accessi..." />
          ) : logs.length === 0 ? (
            <BGEmptyState title="Nessun accesso registrato oggi." />
          ) : (
            <div style={listStyle}>
              {logs.slice(0, 10).map((log) => {
                const customerName = log.customers
                  ? getName(log.customers)
                  : "Cliente non associato";

                return (
                  <div key={log.id} style={rowStyle}>
                    <div>
                      <div style={rowTitleStyle}>
                        {log.customer_id ? (
                          <Link
                            href={`/customers/${log.customer_id}`}
                            style={rowLinkStyle}
                          >
                            {customerName}
                          </Link>
                        ) : (
                          customerName
                        )}
                      </div>
                      <div style={rowMetaStyle}>
                        {new Date(log.created_at).toLocaleTimeString("it-IT")} ·
                        Badge {log.badge_code || "-"}
                      </div>
                      {log.reason && (
                        <div style={rowMetaStyle}>{log.reason}</div>
                      )}
                    </div>

                    <div
                      style={{
                        ...statusBadgeStyle,
                        color: isAllowed(log) ? "#22c55e" : "#ef4444",
                        borderColor: isAllowed(log) ? "#22c55e" : "#ef4444",
                        background: isAllowed(log)
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(239,68,68,0.12)",
                      }}
                    >
                      {isAllowed(log) ? "OK" : "NEGATO"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </BGCard>

        <BGCard className="reception-panel">
          <h2 style={sectionTitleStyle}>Accessi negati</h2>
          <p style={sectionTextStyle}>
            Focus operativo su negazioni e cause principali della giornata.
          </p>

          {loading ? (
            <BGEmptyState title="Caricamento negati..." />
          ) : logs.filter((log) => !isAllowed(log)).length === 0 ? (
            <BGEmptyState title="Nessun accesso negato oggi." />
          ) : (
            <div style={listStyle}>
              {logs
                .filter((log) => !isAllowed(log))
                .slice(0, 10)
                .map((log) => {
                  const customerName = log.customers
                    ? getName(log.customers)
                    : "Cliente non associato";
                  return (
                    <div key={log.id} style={rowStyle}>
                      <div>
                        <div style={rowTitleStyle}>
                          {log.customer_id ? (
                            <Link
                              href={`/customers/${log.customer_id}`}
                              style={rowLinkStyle}
                            >
                              {customerName}
                            </Link>
                          ) : (
                            customerName
                          )}
                        </div>
                        <div style={rowMetaStyle}>
                          {new Date(log.created_at).toLocaleTimeString("it-IT")}{" "}
                          · Badge {log.badge_code || "-"}
                        </div>
                        <div style={rowMetaStyle}>
                          {log.reason || "Motivo non disponibile"}
                        </div>
                      </div>
                      <span
                        style={{
                          ...statusBadgeStyle,
                          color: "#ef4444",
                          borderColor: "#ef4444",
                          background: "rgba(239,68,68,0.12)",
                        }}
                      >
                        NEGATO
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </BGCard>
      </div>

      <div className="reception-stats-grid" style={gridStyle}>
        <BGStatCard
          label="Accessi oggi"
          value={stats.accessToday}
          note="Ingressi autorizzati"
          tone="green"
        />
        <BGStatCard
          label="Accessi negati"
          value={stats.deniedToday}
          note="Richiedono verifica reception"
          tone={stats.deniedToday > 0 ? "red" : "neutral"}
        />
        <BGStatCard
          label="Certificati in scadenza"
          value={stats.certificatesExpiring}
          note="Da gestire nei prossimi 30 giorni"
          tone={stats.certificatesExpiring > 0 ? "yellow" : "neutral"}
        />
        <BGStatCard
          label="Abbonamenti scaduti"
          value={stats.expiredSubscriptions}
          note={`${stats.blockedCustomers} clienti bloccati`}
          tone={stats.expiredSubscriptions > 0 ? "red" : "neutral"}
        />
      </div>
    </main>
  );
}

function BridgeStatusCard({
  status,
  loading,
  onRefresh,
  watchdog,
}: {
  status: BridgeStatus;
  loading: boolean;
  watchdog: BridgeWatchdog;
  onRefresh: () => Promise<void>;
}) {
  const isWarning = status.processing || (status.online && !status.connected);
  const tone = status.online ? (isWarning ? "warning" : "online") : "offline";
  const color =
    tone === "online" ? "#22c55e" : tone === "offline" ? "#ef4444" : "#f59e0b";

  return (
    <div
      style={{
        ...alertCardStyle,
        borderColor: `${color}66`,
        background: `${color}18`,
        display: "grid",
        gap: "10px",
      }}
    >
      <div style={{ ...alertTitleStyle, color }}>
        Bridge {status.online ? "Online" : "Offline"}
      </div>
      <div style={alertTextStyle}>
        Connected controller: {String(status.connected)}
      </div>
      <div style={alertTextStyle}>
        Bridge processing: {String(status.processing)}
      </div>
      <div style={alertTextStyle}>Watchdog: {watchdog.state.toUpperCase()}</div>
      <div style={alertTextStyle}>Ultimo badge: {status.lastBadge || "-"}</div>
      <div style={alertTextStyle}>
        lastBadgeTime:{" "}
        {status.lastBadgeTime
          ? new Date(status.lastBadgeTime).toLocaleString("it-IT")
          : "-"}
      </div>
      <div style={alertTextStyle}>
        ultimo controllo:{" "}
        {status.checkedAt
          ? new Date(status.checkedAt).toLocaleTimeString("it-IT")
          : "-"}
      </div>
      {status.error && (
        <div style={{ ...alertTextStyle, color: "#fecaca" }}>
          Errore: {status.error}
        </div>
      )}
      <button style={bridgeButtonStyle} onClick={onRefresh} disabled={loading}>
        {loading ? "Aggiornamento..." : "Aggiorna stato"}
      </button>
    </div>
  );
}

function AlertCard({
  title,
  text,
  tone,
  href,
}: {
  title: string;
  text: string;
  tone: "danger" | "warning" | "success";
  href?: string;
}) {
  const color =
    tone === "danger" ? "#ef4444" : tone === "warning" ? "#f59e0b" : "#22c55e";

  return (
    <div
      style={{
        ...alertCardStyle,
        borderColor: `${color}66`,
        background: `${color}18`,
      }}
    >
      <div>
        <div style={{ ...alertTitleStyle, color }}>{title}</div>
        <div style={alertTextStyle}>{text}</div>
      </div>

      {href && (
        <Link href={href} style={alertLinkStyle}>
          Verifica
        </Link>
      )}
    </div>
  );
}

function ReceptionAlertsCard({ alerts }: { alerts: ReceptionAlert[] }) {
  const isMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  function formatAlertTime(value: string) {
    if (!isMounted) return "--:--:--";
    return new Date(value).toLocaleTimeString("it-IT");
  }

  return (
    <div
      style={{
        ...alertCardStyle,
        alignItems: "stretch",
        flexDirection: "column",
      }}
    >
      <div style={{ ...alertTitleStyle, color: "#fca5a5" }}>
        Alert Reception
      </div>
      <div style={{ display: "grid", gap: "8px", width: "100%" }}>
        {alerts.map((alert) => (
          <div
            key={alert.id}
            style={{
              background: "rgba(15,23,42,0.55)",
              border: "1px solid rgba(148,163,184,.25)",
              borderRadius: "12px",
              padding: "10px",
            }}
          >
            <div style={{ fontWeight: 800 }}>
              {alert.type} · {alert.severity.toUpperCase()}
            </div>
            <div style={alertTextStyle}>{alert.message}</div>
            <div style={alertTextStyle}>
              Orario: {formatAlertTime(alert.time)} · Riferimento:{" "}
              {alert.badgeOrCustomer}
            </div>
            <div style={alertTextStyle}>Azione: {alert.suggestedAction}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div style={cardStyle}>
      <div style={cardTitleStyle}>{title}</div>
      <div style={cardValueStyle}>{value}</div>
      <div style={cardNoteStyle}>{note}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  color: "var(--text)",
};

const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "24px",
  marginBottom: "30px",
  padding: "30px",
  borderRadius: "30px",
  background:
    "radial-gradient(circle at top left, rgba(239,68,68,0.20), transparent 35%), linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
};

const eyebrowStyle: React.CSSProperties = {
  color: "var(--accent)",
  fontSize: "13px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "1px",
};

const titleStyle: React.CSSProperties = {
  color: "var(--text)",
  fontSize: "42px",
  lineHeight: "1.05",
  margin: "10px 0",
  letterSpacing: "-2px",
};

const subtitleStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "16px",
  margin: 0,
  maxWidth: "620px",
};

const liveBadgeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "rgba(34,197,94,0.12)",
  color: "#22c55e",
  border: "1px solid rgba(34,197,94,0.25)",
  borderRadius: "999px",
  padding: "12px 18px",
  fontWeight: 800,
};

const dotStyle: React.CSSProperties = {
  width: "9px",
  height: "9px",
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow: "0 0 16px #22c55e",
};

const firstRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.1fr 1.4fr 0.8fr",
  gap: "14px",
  marginBottom: "24px",
};

const alertCardStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: "22px",
  padding: "18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
};

const alertTitleStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: "15px",
  marginBottom: "6px",
};

const alertTextStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "13px",
  lineHeight: 1.5,
};

const alertLinkStyle: React.CSSProperties = {
  color: "white",
  background: "var(--accent)",
  padding: "10px 14px",
  borderRadius: "14px",
  textDecoration: "none",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const bridgeButtonStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  color: "var(--text)",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: "12px",
  padding: "10px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
  gap: "18px",
  marginBottom: "24px",
};

const secondRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr",
  gap: "24px",
};

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "26px",
  minHeight: "150px",
  boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
};

const cardTitleStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "14px",
  fontWeight: 700,
  marginBottom: "12px",
};

const cardValueStyle: React.CSSProperties = {
  color: "var(--text)",
  fontSize: "42px",
  fontWeight: 900,
  letterSpacing: "-2px",
};

const cardNoteStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "13px",
};

const panelStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "28px",
  boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  marginBottom: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "22px",
  margin: "0 0 8px",
};

const sectionTextStyle: React.CSSProperties = {
  color: "var(--muted)",
  margin: 0,
};

const emptyStyle: React.CSSProperties = {
  marginTop: "18px",
  color: "var(--muted)",
  border: "1px dashed var(--border)",
  borderRadius: "18px",
  padding: "18px",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  marginTop: "18px",
};

const rowStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "18px",
  padding: "16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
};

const rowTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: "16px",
};

const rowLinkStyle: React.CSSProperties = {
  color: "#ffffff",
  textDecoration: "none",
};

const rowMetaStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "13px",
  marginTop: "5px",
};

const statusBadgeStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: "999px",
  padding: "8px 12px",
  fontWeight: 900,
  fontSize: "12px",
  whiteSpace: "nowrap",
};

const heroActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const primaryButtonStyle: React.CSSProperties = {
  color: "white",
  background: "linear-gradient(180deg,#ef4444,#b91c1c)",
  border: "1px solid rgba(239,68,68,0.5)",
  borderRadius: "14px",
  padding: "12px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.72)",
  display: "grid",
  placeItems: "center",
  zIndex: 80,
  padding: "24px",
};

const modalStyle: React.CSSProperties = {
  width: "min(980px, 100%)",
  maxHeight: "88vh",
  overflowY: "auto",
  background: "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "24px",
  padding: "22px",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "14px",
};

const closeButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  fontSize: "24px",
  cursor: "pointer",
};

const modalFormStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
};

const modalGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
};

const modalActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
};

const labelStyle: React.CSSProperties = {
  color: "var(--muted)",
  display: "grid",
  gap: "6px",
  fontSize: "12px",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "10px 12px",
  color: "var(--text)",
};

const errorStyle: React.CSSProperties = { color: "#fca5a5" };
const warningStyle: React.CSSProperties = {
  color: "#fcd34d",
  fontSize: "13px",
};
const successStyle: React.CSSProperties = { color: "#86efac" };

const smallLinkStyle: React.CSSProperties = {
  color: "white",
  background: "var(--accent)",
  padding: "10px 14px",
  borderRadius: "14px",
  textDecoration: "none",
  fontWeight: 800,
  whiteSpace: "nowrap",
};
