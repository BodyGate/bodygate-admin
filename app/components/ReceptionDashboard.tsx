"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type Customer = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  active: boolean | null;
  subscription_status: string | null;
  subscription_expiry: string | null;
};

type AccessLog = {
  id: string;
  created_at: string;
  customer_id: string | null;
  badge_code: string | null;
  controller_code: string | null;
  allowed: boolean;
  reason: string | null;
  customers?: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};



type CustomerAccessLog = {
  id: string;
  created_at: string;
  customer_id: string | null;
  badge_code: string | null;
  allowed: boolean;
  denial_reason: string | null;
  customers?: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
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

type QuickCreateForm = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  tax_code: string;
  badge_code: string;
  controller_code: string;
  medical_valid_from: string;
  medical_valid_until: string;
  membership_valid_until: string;
  subscription_starts_at: string;
  subscription_ends_at: string;
};

type Certificate = {
  id: string;
  customer_id: string;
  valid_from: string;
  valid_until: string;
  customers?: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
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
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [customerAccessLogs, setCustomerAccessLogs] = useState<CustomerAccessLog[]>([]);
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

  const [showQuickModal, setShowQuickModal] = useState(false);
  const [savingQuick, setSavingQuick] = useState(false);
  const [quickError, setQuickError] = useState("");
  const [quickSuccess, setQuickSuccess] = useState("");
  const [quickWarnings, setQuickWarnings] = useState<string[]>([]);

  const [quickForm, setQuickForm] = useState<QuickCreateForm>({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    tax_code: "",
    badge_code: "",
    controller_code: "",
    medical_valid_from: "",
    medical_valid_until: "",
    membership_valid_until: "",
    subscription_starts_at: "",
    subscription_ends_at: "",
  });

  function getName(item: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  }) {
    const full = item.full_name?.trim();
    const firstLast = `${item.first_name || ""} ${item.last_name || ""}`.trim();
    return full || firstLast || "Cliente";
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
      { data: customersData },
      { data: logsData },
      { data: certificatesData },
      { data: customerAccessData },
      { data: gymPresenceData },
    ] = await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, full_name, first_name, last_name, active, subscription_status, subscription_expiry"
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("access_logs")
        .select(`
          id,
          created_at,
          customer_id,
          badge_code,
          controller_code,
          allowed,
          reason,
          customers (
            full_name,
            first_name,
            last_name
          )
        `)
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(30),

      supabase
        .from("medical_certificates")
        .select(`
          id,
          customer_id,
          valid_from,
          valid_until,
          customers (
            full_name,
            first_name,
            last_name
          )
        `)
        .gte("valid_until", today)
        .lte("valid_until", in30Days)
        .order("valid_until", { ascending: true })
        .limit(20),

      supabase
        .from("customer_access_logs")
        .select(`
          id,
          created_at,
          customer_id,
          badge_code,
          allowed,
          denial_reason,
          customers (
            full_name,
            first_name,
            last_name
          )
        `)
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(120),

      supabase
        .from("gym_presence")
        .select("id, customer_id, badge_code, is_inside, updated_at")
        .order("updated_at", { ascending: false })
        .limit(120),
    ]);

    setCustomers((customersData || []) as Customer[]);
    setLogs((logsData || []) as AccessLog[]);
    setCertificates((certificatesData || []) as Certificate[]);
    setCustomerAccessLogs((customerAccessData || []) as CustomerAccessLog[]);
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
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers" },
        () => loadData()
      )
       .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "medical_certificates" },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_access_logs" },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gym_presence" },
        () => loadData()
      )
      .subscribe();

    return () => {
      window.clearInterval(bridgeInterval);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  function setQuickField<K extends keyof QuickCreateForm>(
    key: K,
    value: QuickCreateForm[K]
  ) {
    setQuickForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetQuickForm() {
    setQuickForm({
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      tax_code: "",
      badge_code: "",
      controller_code: "",
      medical_valid_from: "",
      medical_valid_until: "",
      membership_valid_until: "",
      subscription_starts_at: "",
      subscription_ends_at: "",
    });
    setQuickWarnings([]);
    setQuickError("");
  }

  function isMissingTableError(message: string) {
    const lower = message.toLowerCase();
    return (
      lower.includes("does not exist") ||
      lower.includes("42p01") ||
      lower.includes("relation")
    );
  }

  async function submitQuickCustomer(e: React.FormEvent) {
  e.preventDefault();
  setQuickError("");
  setQuickSuccess("");
  setQuickWarnings([]);

  const firstName = quickForm.first_name.trim();
  const lastName = quickForm.last_name.trim();

  if (!firstName || !lastName) {
    setQuickError("Nome e cognome sono obbligatori.");
    return;
  }

  const badgeCode = quickForm.badge_code.trim();
  const controllerCode = quickForm.controller_code.trim();

  if (!badgeCode && !controllerCode) {
    setQuickError(
      "Inserisci almeno badge code o controller code per creare la credenziale di accesso."
    );
    return;
  }

  if (
    quickForm.medical_valid_from &&
    quickForm.medical_valid_until &&
    quickForm.medical_valid_until < quickForm.medical_valid_from
  ) {
    setQuickError(
      "La data fine certificato non può essere precedente alla data inizio."
    );
    return;
  }

  if (
    quickForm.subscription_starts_at &&
    quickForm.subscription_ends_at &&
    quickForm.subscription_ends_at < quickForm.subscription_starts_at
  ) {
    setQuickError(
      "La data fine abbonamento non può essere precedente alla data inizio."
    );
    return;
  }

  setSavingQuick(true);

  try {
    const response = await fetch("/api/customers/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: quickForm.first_name,
        last_name: quickForm.last_name,
        phone: quickForm.phone,
        email: quickForm.email,
        tax_code: quickForm.tax_code,
        badge_code: quickForm.badge_code,
        controller_code: quickForm.controller_code,
        medical_valid_from: quickForm.medical_valid_from,
        medical_valid_until: quickForm.medical_valid_until,
        membership_valid_until: quickForm.membership_valid_until,
        subscription_starts_at: quickForm.subscription_starts_at,
        subscription_ends_at: quickForm.subscription_ends_at,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      setQuickError(result.error || "Errore creazione cliente rapido.");
      setSavingQuick(false);
      return;
    }

    setQuickWarnings(Array.isArray(result.warnings) ? result.warnings : []);
    setQuickSuccess("Nuovo cliente rapido creato correttamente.");

    await loadData();
    resetQuickForm();
    setShowQuickModal(false);
  } catch (error) {
    console.error(error);
    setQuickError("Errore imprevisto durante la creazione cliente.");
  } finally {
    setSavingQuick(false);
  }
}

  const stats = useMemo(() => {
    const today = todayString();

    const accessToday = logs.filter((log) => log.allowed).length;
    const deniedToday = logs.filter((log) => !log.allowed).length;

    const expiredSubscriptions = customers.filter((customer) => {
      const expiry = customer.subscription_expiry
        ? String(customer.subscription_expiry).slice(0, 10)
        : null;

      return (
        !customer.active ||
        customer.subscription_status !== "active" ||
        !expiry ||
        expiry < today
      );
    }).length;

    const blockedCustomers = customers.filter((customer) => !customer.active).length;

    const latestDenied = logs.find((log) => !log.allowed);

    return {
      accessToday,
      deniedToday,
      certificatesExpiring: certificates.length,
      expiredSubscriptions,
      blockedCustomers,
      latestDenied,
    };
  }, [customers, logs, certificates]);

  const receptionAlerts = useMemo<ReceptionAlert[]>(() => {
    const items: ReceptionAlert[] = [];
    const now = new Date().toISOString();

    const latestDenied = customerAccessLogs.find((log) => !log.allowed) || logs.find((log) => !log.allowed);
    const insideNow = gymPresence.filter((p) => p.is_inside).length;

    if (!bridgeStatus.online || bridgeWatchdog.state === "offline") {
      items.push({
        id: "bridge-offline",
        type: "Bridge offline",
        severity: "critical",
        message: "Bridge non raggiungibile: il tornello non può autorizzare accessi in modo affidabile.",
        suggestedAction: "Verifica servizio bridge su Windows e connettività rete verso controller.",
        time: bridgeWatchdog.checked_at || bridgeStatus.checkedAt || now,
        badgeOrCustomer: bridgeStatus.lastBadge || "N/A",
      });
    }

    if (bridgeWatchdog.state === "degraded" || (bridgeStatus.online && !bridgeStatus.connected)) {
      items.push({
        id: "bridge-degraded",
        type: "Bridge degraded",
        severity: "warning",
        message: "Bridge online ma centralina non connessa stabilmente.",
        suggestedAction: "Controlla cablaggio/IP controller e rilancia health check.",
        time: bridgeWatchdog.checked_at || bridgeStatus.checkedAt || now,
        badgeOrCustomer: bridgeStatus.lastBadge || "N/A",
      });
    }

    const unknownBadge = customerAccessLogs.find((log) => !log.allowed && (log.denial_reason || "").toLowerCase().includes("badge")) || logs.find((log) => !log.allowed && (log.reason || "").toLowerCase().includes("badge"));
    if (unknownBadge) {
      items.push({
        id: "unknown-badge",
        type: "Badge sconosciuto",
        severity: "critical",
        message: "Rilevato badge non associato a nessun cliente.",
        suggestedAction: "Identifica la persona e registra/assegna badge corretto.",
        time: unknownBadge.created_at,
        badgeOrCustomer: unknownBadge.badge_code || "Badge non disponibile",
      });
    }

    const pushByReason = (id:string, type:string, lookups:string[], action:string) => {
      const target = customerAccessLogs.find((log) => !log.allowed && lookups.some((lk) => (log.denial_reason || "").toLowerCase().includes(lk))) ||
        logs.find((log) => !log.allowed && lookups.some((lk) => (log.reason || "").toLowerCase().includes(lk)));
      if (!target) return;
      const customerName = target.customers ? getName(target.customers) : "Cliente non associato";
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

    pushByReason("expired-sub", "Accesso negato: abbonamento", ["abbon", "subscription"], "Invita il cliente al rinnovo o attiva nuovo abbonamento.");
    pushByReason("expired-cert", "Accesso negato: certificato medico", ["certificat", "medical"], "Richiedi certificato valido e aggiorna anagrafica.");
    pushByReason("missing-fee", "Accesso negato: quota associativa", ["quota", "membership"], "Regolarizza quota associativa prima del nuovo accesso.");

    const blocked = customerAccessLogs.find((log) => !log.allowed && (log.denial_reason || "").toLowerCase().includes("blocc")) || logs.find((log) => !log.allowed && (log.reason || "").toLowerCase().includes("blocc"));
    if (blocked) {
      const customerName = blocked.customers ? getName(blocked.customers) : "Cliente bloccato";
      items.push({
        id: "blocked-customer",
        type: "Cliente bloccato",
        severity: "critical",
        message: "Accesso negato a cliente marcato come bloccato/non attivo.",
        suggestedAction: "Controlla motivazione blocco e autorizzazioni amministrative.",
        time: blocked.created_at,
        badgeOrCustomer: `${customerName} • ${blocked.badge_code || "Badge -"}`,
      });
    }

    const deniedMap = new Map<string, { count:number; latest:string }>();
    customerAccessLogs.filter((log) => !log.allowed).forEach((log) => {
      const key = log.customer_id || log.badge_code || "unknown";
      const current = deniedMap.get(key) || { count: 0, latest: log.created_at };
      current.count += 1;
      if (new Date(log.created_at) > new Date(current.latest)) current.latest = log.created_at;
      deniedMap.set(key, current);
    });
    const repeat = [...deniedMap.entries()].find(([,v]) => v.count >= 3);
    if (repeat) {
      items.push({
        id: "repeat-denied",
        type: "Accessi negati ripetuti",
        severity: "critical",
        message: `Rilevati ${repeat[1].count} accessi negati ripetuti sullo stesso badge/cliente oggi.`,
        suggestedAction: "Contatta subito la reception desk per verifica identità e posizione amministrativa.",
        time: repeat[1].latest,
        badgeOrCustomer: repeat[0],
      });
    }

    if (latestDenied && items.length === 0) {
      items.push({
        id: "generic-denied",
        type: "Accesso negato",
        severity: "info",
        message: "È presente almeno un accesso negato, senza pattern critici configurati.",
        suggestedAction: "Apri il registro accessi e verifica il motivo denial.",
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

    return items.sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 8);
  }, [bridgeStatus, bridgeWatchdog, customerAccessLogs, logs, gymPresence]);

  function systemStatusLabel(state: BridgeWatchdog["state"]) {
    if (state === "online") return "Sistema operativo";
    if (state === "degraded") return "Sistema degradato";
    return "Sistema critico";
  }

  function systemBadgeStyle(state: BridgeWatchdog["state"]): React.CSSProperties {
    const color = state === "online" ? "#22c55e" : state === "degraded" ? "#f59e0b" : "#ef4444";
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
    <main style={pageStyle}>
      <div style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>BodyGate Reception</div>
          <h1 style={titleStyle}>Reception live</h1>
          <p style={subtitleStyle}>
            Console operativa realtime per gestire ingressi, alert e clienti senza perdere priorità.
          </p>
        </div>

        <div style={heroActionsStyle}>
          <div style={systemBadgeStyle(bridgeWatchdog.state)}>
            {systemStatusLabel(bridgeWatchdog.state)}
          </div>
          <button
            style={secondaryButtonStyle}
            onClick={() => {
              loadData();
              loadBridgeStatus();
            }}
          >
            Aggiorna dashboard
          </button>
          <button style={primaryButtonStyle} onClick={() => setShowQuickModal(true)}>
            Nuovo cliente rapido
          </button>
          <div style={liveBadgeStyle}>
            <span style={dotStyle} />
            Polling live 5s
          </div>
        </div>
      </div>

      {showQuickModal && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0 }}>Nuovo cliente rapido</h2>
              <button
                style={closeButtonStyle}
                onClick={() => {
                  setShowQuickModal(false);
                  setQuickError("");
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={submitQuickCustomer} style={modalFormStyle}>
              <div style={modalGridStyle}>
                <input
                  style={inputStyle}
                  placeholder="Nome"
                  value={quickForm.first_name}
                  onChange={(e) => setQuickField("first_name", e.target.value)}
                />
                <input
                  style={inputStyle}
                  placeholder="Cognome"
                  value={quickForm.last_name}
                  onChange={(e) => setQuickField("last_name", e.target.value)}
                />
                <input
                  style={inputStyle}
                  placeholder="Telefono"
                  value={quickForm.phone}
                  onChange={(e) => setQuickField("phone", e.target.value)}
                />
                <input
                  style={inputStyle}
                  placeholder="Email"
                  value={quickForm.email}
                  onChange={(e) => setQuickField("email", e.target.value)}
                />
                <input
                  style={inputStyle}
                  placeholder="Codice fiscale"
                  value={quickForm.tax_code}
                  onChange={(e) => setQuickField("tax_code", e.target.value.toUpperCase())}
                />
                <input
                  style={inputStyle}
                  placeholder="Badge code"
                  value={quickForm.badge_code}
                  onChange={(e) => setQuickField("badge_code", e.target.value)}
                />
                <input
                  style={inputStyle}
                  placeholder="Controller code (opzionale)"
                  value={quickForm.controller_code}
                  onChange={(e) => setQuickField("controller_code", e.target.value)}
                />
                <label style={labelStyle}>
                  Inizio certificato
                  <input
                    type="date"
                    style={inputStyle}
                    value={quickForm.medical_valid_from}
                    onChange={(e) => setQuickField("medical_valid_from", e.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Fine certificato
                  <input
                    type="date"
                    style={inputStyle}
                    value={quickForm.medical_valid_until}
                    onChange={(e) => setQuickField("medical_valid_until", e.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Quota associativa fino al
                  <input
                    type="date"
                    style={inputStyle}
                    value={quickForm.membership_valid_until}
                    onChange={(e) => setQuickField("membership_valid_until", e.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Abbonamento dal
                  <input
                    type="date"
                    style={inputStyle}
                    value={quickForm.subscription_starts_at}
                    onChange={(e) =>
                      setQuickField("subscription_starts_at", e.target.value)
                    }
                  />
                </label>
                <label style={labelStyle}>
                  Abbonamento al
                  <input
                    type="date"
                    style={inputStyle}
                    value={quickForm.subscription_ends_at}
                    onChange={(e) => setQuickField("subscription_ends_at", e.target.value)}
                  />
                </label>
              </div>

              {quickError && <div style={errorStyle}>{quickError}</div>}
              {quickWarnings.length > 0 && (
                <div style={warningStyle}>
                  {quickWarnings.map((w) => (
                    <div key={w}>• {w}</div>
                  ))}
                </div>
              )}
              {quickSuccess && <div style={successStyle}>{quickSuccess}</div>}

              <div style={modalActionsStyle}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => {
                    setShowQuickModal(false);
                    setQuickError("");
                  }}
                >
                  Annulla
                </button>
                <button type="submit" style={primaryButtonStyle} disabled={savingQuick}>
                  {savingQuick ? "Salvataggio..." : "Salva cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={firstRowStyle}>
        <BridgeStatusCard
          status={bridgeStatus}
          loading={bridgeLoading}
          watchdog={bridgeWatchdog}
          onRefresh={loadBridgeStatus}
        />
        {receptionAlerts.length > 0 ? (
          <ReceptionAlertsCard alerts={receptionAlerts} />
        ) : (
          <AlertCard title="Alert Reception" text="Nessuna anomalia critica attiva." tone="success" />
        )}
        <Card title="Presenti ora" value={String(gymPresence.filter((p) => p.is_inside).length)} note="Clienti attualmente in palestra" />
      </div>

      <div style={secondRowStyle}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Accessi recenti</h2>
              <p style={sectionTextStyle}>Ultimi eventi dal tornello, aggiornati in tempo reale.</p>
            </div>

            <Link href="/access-logs" style={smallLinkStyle}>
              Apri registro
            </Link>
          </div>

          {loading ? (
            <div style={emptyStyle}>Caricamento accessi...</div>
          ) : logs.length === 0 ? (
            <div style={emptyStyle}>Nessun accesso registrato oggi.</div>
          ) : (
            <div style={listStyle}>
              {logs.slice(0, 10).map((log) => {
                const customerName = log.customers
                  ? getName(log.customers)
                  : "Cliente non associato";

                return (
                  <div key={log.id} style={rowStyle}>
                    <div>
                      <div style={rowTitleStyle}>{customerName}</div>
                      <div style={rowMetaStyle}>
                        {new Date(log.created_at).toLocaleTimeString("it-IT")} · Badge{" "}
                        {log.badge_code || "-"}
                      </div>
                      {log.reason && <div style={rowMetaStyle}>{log.reason}</div>}
                    </div>

                    <div
                      style={{
                        ...statusBadgeStyle,
                        color: log.allowed ? "#22c55e" : "#ef4444",
                        borderColor: log.allowed ? "#22c55e" : "#ef4444",
                        background: log.allowed
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(239,68,68,0.12)",
                      }}
                    >
                      {log.allowed ? "OK" : "NEGATO"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Accessi negati</h2>
          <p style={sectionTextStyle}>Focus operativo su negazioni e cause principali della giornata.</p>

          {loading ? (
            <div style={emptyStyle}>Caricamento negati...</div>
          ) : customerAccessLogs.filter((log) => !log.allowed).length === 0 ? (
            <div style={emptyStyle}>Nessun accesso negato oggi.</div>
          ) : (
            <div style={listStyle}>
              {customerAccessLogs.filter((log) => !log.allowed).slice(0, 10).map((log) => {
                const customerName = log.customers ? getName(log.customers) : "Cliente non associato";
                return (
                  <div key={log.id} style={rowStyle}>
                    <div>
                      <div style={rowTitleStyle}>{customerName}</div>
                      <div style={rowMetaStyle}>
                        {new Date(log.created_at).toLocaleTimeString("it-IT")} · Badge {log.badge_code || "-"}
                      </div>
                      <div style={rowMetaStyle}>{log.denial_reason || "Motivo non disponibile"}</div>
                    </div>
                    <span style={{ ...statusBadgeStyle, color: "#ef4444", borderColor: "#ef4444", background: "rgba(239,68,68,0.12)" }}>NEGATO</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div style={gridStyle}>
        <Card title="Accessi oggi" value={String(stats.accessToday)} note="Ingressi autorizzati" />
        <Card title="Accessi negati" value={String(stats.deniedToday)} note="Richiedono verifica reception" />
        <Card
          title="Certificati in scadenza"
          value={String(stats.certificatesExpiring)}
          note="Da gestire nei prossimi 30 giorni"
        />
        <Card
          title="Abbonamenti scaduti"
          value={String(stats.expiredSubscriptions)}
          note={`${stats.blockedCustomers} clienti bloccati`}
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
      <div style={alertTextStyle}>Connected controller: {String(status.connected)}</div>
      <div style={alertTextStyle}>Bridge processing: {String(status.processing)}</div>
      <div style={alertTextStyle}>Watchdog: {watchdog.state.toUpperCase()}</div>
      <div style={alertTextStyle}>Ultimo badge: {status.lastBadge || "-"}</div>
      <div style={alertTextStyle}>
        lastBadgeTime:{" "}
        {status.lastBadgeTime ? new Date(status.lastBadgeTime).toLocaleString("it-IT") : "-"}
      </div>
      <div style={alertTextStyle}>
        ultimo controllo:{" "}
        {status.checkedAt ? new Date(status.checkedAt).toLocaleTimeString("it-IT") : "-"}
      </div>
      {status.error && <div style={{ ...alertTextStyle, color: "#fecaca" }}>Errore: {status.error}</div>}
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function formatAlertTime(value: string) {
    if (!isMounted) return "--:--:--";
    return new Date(value).toLocaleTimeString("it-IT");
  }

  return (
    <div style={{ ...alertCardStyle, alignItems: "stretch", flexDirection: "column" }}>
      <div style={{ ...alertTitleStyle, color: "#fca5a5" }}>Alert Reception</div>
      <div style={{ display: "grid", gap: "8px", width: "100%" }}>
        {alerts.map((alert) => (
          <div key={alert.id} style={{ background: "rgba(15,23,42,0.55)", border: "1px solid rgba(148,163,184,.25)", borderRadius: "12px", padding: "10px" }}>
            <div style={{ fontWeight: 800 }}>{alert.type} · {alert.severity.toUpperCase()}</div>
            <div style={alertTextStyle}>{alert.message}</div>
            <div style={alertTextStyle}>Orario: {formatAlertTime(alert.time)} · Riferimento: {alert.badgeOrCustomer}</div>
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
const warningStyle: React.CSSProperties = { color: "#fcd34d", fontSize: "13px" };
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
