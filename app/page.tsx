"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "./lib/supabaseClient";

type Customer = {
  id: string;
  is_active: boolean | null;
};

type Subscription = {
  id: string;
  is_active: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
};

type AccessLog = {
  id: string;
  access_time: string;
  customer_id: string | null;
  badge_code: string | null;
  controller_code: string | null;
  was_allowed: boolean;
  reason: string | null;
  customers?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export default function DashboardHome() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [lockdown, setLockdown] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  function todayStartIso() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  async function callBridge(endpoint: string, loadingKey: string) {
    try {
      setActionLoading(loadingKey);

      const res = await fetch(`http://localhost:5050/${endpoint}`);
      const data = await res.json();

      alert(data?.message || "Comando inviato");
      await checkBridgeStatus();
    } catch (error) {
      alert("Bridge non raggiungibile. Verifica che sia avviato.");
      setBridgeOnline(false);
    } finally {
      setActionLoading("");
    }
  }

  async function checkBridgeStatus() {
    try {
      const res = await fetch("http://localhost:5050/status");
      const data = await res.json();

      setBridgeOnline(Boolean(data?.connected));
      setLockdown(Boolean(data?.lockdown));
    } catch {
      setBridgeOnline(false);
    }
  }

  async function loadDashboard() {
    setLoading(true);

    const [{ data: customersData }, { data: subscriptionsData }, { data: logsData }] =
      await Promise.all([
        supabase.from("customers").select("id, is_active"),

        supabase
          .from("customer_subscriptions")
          .select("id, is_active, starts_at, ends_at")
          .eq("is_active", true)
          .lte("starts_at", today)
          .gte("ends_at", today),

        supabase
          .from("customer_access_logs")
          .select(`
            id,
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
          `)
          .gte("access_time", todayStartIso())
          .order("access_time", { ascending: false })
          .limit(20),
      ]);

    setCustomers((customersData || []) as Customer[]);
    setSubscriptions((subscriptionsData || []) as Subscription[]);
    setAccessLogs((logsData || []) as AccessLog[]);
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
    checkBridgeStatus();

    const interval = window.setInterval(() => {
      loadDashboard();
      checkBridgeStatus();
    }, 3000);

    const channel = supabase
      .channel("dashboard_customer_access_logs_live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_access_logs",
        },
        () => loadDashboard()
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const activeCustomers = customers.filter((c) => c.is_active).length;
    const accessToday = accessLogs.filter((log) => log.was_allowed).length;
    const deniedToday = accessLogs.filter((log) => !log.was_allowed).length;

    return {
      totalCustomers: customers.length,
      activeCustomers,
      activeSubscriptions: subscriptions.length,
      accessToday,
      deniedToday,
    };
  }, [customers, subscriptions, accessLogs]);

  function getCustomerName(log: AccessLog) {
    const firstName = log.customers?.first_name || "";
    const lastName = log.customers?.last_name || "";
    return `${firstName} ${lastName}`.trim() || "Badge non associato";
  }

  return (
    <div style={pageStyle}>
      <div style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>BodyGate Platform</div>
          <h1 style={titleStyle}>Dashboard operativa</h1>
          <p style={subtitleStyle}>
            Dati reali da Supabase: clienti, accessi giornalieri, abbonamenti e stato sistema.
          </p>
        </div>

        <div style={bridgeOnline ? systemBadgeStyle : systemBadgeDangerStyle}>
          <span style={bridgeOnline ? dotStyle : dotDangerStyle} />
          {bridgeOnline ? "Sistema attivo" : "Bridge offline"}
        </div>
      </div>

      <div style={gridStatsStyle}>
        <Card title="Accessi oggi" value={String(stats.accessToday)} note="Ingressi autorizzati" />
        <Card title="Accessi negati" value={String(stats.deniedToday)} note="Badge bloccati o non validi" />
        <Card title="Clienti registrati" value={String(stats.totalCustomers)} note={`${stats.activeCustomers} clienti attivi`} />
        <Card title="Abbonamenti attivi" value={String(stats.activeSubscriptions)} note="Validi oggi" />
      </div>

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Controllo tornello</h2>
              <p style={sectionTextStyle}>
                Azioni rapide per reception e test accessi.
              </p>
            </div>

            <div style={bridgeOnline ? miniBadgeStyle : miniBadgeDangerStyle}>
              {bridgeOnline ? "Bridge online" : "Bridge offline"}
            </div>
          </div>

          <div style={buttonRowStyle}>
            <button
              style={primaryButtonStyle}
              onClick={() => callBridge("open-in", "open-in")}
              disabled={actionLoading !== ""}
            >
              {actionLoading === "open-in" ? "Apertura..." : "Apri tornello"}
            </button>

            <button
              style={warningButtonStyle}
              onClick={() => callBridge("stop", "stop")}
              disabled={actionLoading !== ""}
            >
              {actionLoading === "stop" ? "Attivo..." : "Lockdown"}
            </button>

            <button
              style={secondaryButtonStyle}
              onClick={() => callBridge("unlock", "unlock")}
              disabled={actionLoading !== ""}
            >
              {actionLoading === "unlock" ? "Sblocco..." : "Sblocca"}
            </button>
          </div>

          <div style={lockdown ? lockdownStyle : normalStyle}>
            {lockdown
              ? "STOP ATTIVO: aperture manuali bloccate. I badge validi continuano a funzionare."
              : "Sistema in modalità normale."}
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Stato sistema</h2>
          <p style={sectionTextStyle}>Monitoraggio dei servizi principali BodyGate.</p>

          <div style={statusListStyle}>
            <StatusRow label="Bridge tornello" value={bridgeOnline ? "Online" : "Offline"} ok={bridgeOnline} />
            <StatusRow label="Controller accessi" value={bridgeOnline ? "Online" : "Da verificare"} ok={bridgeOnline} />
            <StatusRow label="Database Supabase" value="Online" ok />
            <StatusRow label="Realtime dashboard" value="Attivo" ok />
          </div>
        </section>
      </div>

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Ultimi accessi di oggi</h2>
          <p style={sectionTextStyle}>Aggiornamento automatico ogni 3 secondi.</p>

          {loading ? (
            <div style={emptyStyle}>Caricamento accessi...</div>
          ) : accessLogs.length === 0 ? (
            <div style={emptyStyle}>Nessun accesso registrato oggi.</div>
          ) : (
            <div style={logsListStyle}>
              {accessLogs.slice(0, 8).map((log) => (
                <div key={log.id} style={logRowStyle}>
                  <div>
                    <strong>{log.was_allowed ? "Accesso consentito" : "Accesso negato"}</strong>
                    <div style={mutedSmallStyle}>{getCustomerName(log)}</div>
                    <div style={mutedSmallStyle}>
                      Badge: {log.badge_code || "-"} · Controller: {log.controller_code || "-"}
                    </div>
                    <div style={mutedSmallStyle}>{log.reason || "-"}</div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={logStatusStyle(log.was_allowed)}>
                      {log.was_allowed ? "OK" : "NO"}
                    </div>
                    <div style={mutedSmallStyle}>
                      {new Date(log.access_time).toLocaleTimeString("it-IT")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link href="/access-logs" style={linkButtonStyle}>
            Apri monitor accessi
          </Link>
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Backoffice</h2>
          <p style={sectionTextStyle}>
            Gestione clienti, badge, abbonamenti, pagamenti e programmi.
          </p>

          <div style={quickLinksStyle}>
            <Link href="/customers" style={quickLinkStyle}>Clienti</Link>
            <Link href="/badges" style={quickLinkStyle}>Badge</Link>
            <Link href="/subscriptions" style={quickLinkStyle}>Abbonamenti</Link>
            <Link href="/payments" style={quickLinkStyle}>Pagamenti</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div style={cardStyle}>
      <div>
        <div style={cardTitleStyle}>{title}</div>
        <div style={cardValueStyle}>{value}</div>
      </div>
      <div style={cardNoteStyle}>{note}</div>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={statusRowStyle}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ color: ok ? "var(--success)" : "var(--danger)", fontWeight: 800 }}>
        {value}
      </span>
    </div>
  );
}

const pageStyle: React.CSSProperties = { color: "var(--text)" };

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

const systemBadgeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "rgba(34,197,94,0.12)",
  color: "var(--success)",
  border: "1px solid rgba(34,197,94,0.25)",
  borderRadius: "999px",
  padding: "12px 18px",
  fontWeight: 800,
  fontSize: "13px",
  whiteSpace: "nowrap",
};

const systemBadgeDangerStyle: React.CSSProperties = {
  ...systemBadgeStyle,
  background: "rgba(239,68,68,0.12)",
  color: "var(--danger)",
  border: "1px solid rgba(239,68,68,0.25)",
};

const dotStyle: React.CSSProperties = {
  width: "9px",
  height: "9px",
  borderRadius: "50%",
  background: "var(--success)",
  boxShadow: "0 0 16px var(--success)",
};

const dotDangerStyle: React.CSSProperties = {
  ...dotStyle,
  background: "var(--danger)",
  boxShadow: "0 0 16px var(--danger)",
};

const gridStatsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
  gap: "18px",
  marginBottom: "24px",
};

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "26px",
  minHeight: "160px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
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

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "24px",
  marginBottom: "24px",
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
  alignItems: "flex-start",
  gap: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  color: "var(--text)",
  fontSize: "22px",
  margin: "0 0 10px",
  letterSpacing: "-0.5px",
};

const sectionTextStyle: React.CSSProperties = {
  color: "var(--muted)",
  margin: "0 0 22px",
  lineHeight: 1.6,
};

const miniBadgeStyle: React.CSSProperties = {
  background: "rgba(34,197,94,0.10)",
  color: "var(--success)",
  border: "1px solid rgba(34,197,94,0.25)",
  borderRadius: "999px",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const miniBadgeDangerStyle: React.CSSProperties = {
  ...miniBadgeStyle,
  background: "rgba(239,68,68,0.10)",
  color: "var(--danger)",
  border: "1px solid rgba(239,68,68,0.25)",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const baseButtonStyle: React.CSSProperties = {
  border: "none",
  color: "white",
  padding: "14px 20px",
  borderRadius: "18px",
  fontWeight: 800,
  fontSize: "15px",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  background: "linear-gradient(to right, #ef4444, #dc2626)",
};

const warningButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  background: "linear-gradient(to right, #f59e0b, #d97706)",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
};

const lockdownStyle: React.CSSProperties = {
  marginTop: "18px",
  padding: "12px 14px",
  borderRadius: "16px",
  background: "rgba(245,158,11,0.12)",
  border: "1px solid rgba(245,158,11,0.28)",
  color: "#fbbf24",
  fontSize: "13px",
  fontWeight: 800,
};

const normalStyle: React.CSSProperties = {
  marginTop: "18px",
  padding: "12px 14px",
  borderRadius: "16px",
  background: "rgba(34,197,94,0.10)",
  border: "1px solid rgba(34,197,94,0.25)",
  color: "var(--success)",
  fontSize: "13px",
  fontWeight: 800,
};

const statusListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const statusRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  borderBottom: "1px solid var(--border)",
  paddingBottom: "12px",
};

const emptyStyle: React.CSSProperties = {
  color: "var(--muted)",
  border: "1px dashed var(--border)",
  borderRadius: "18px",
  padding: "18px",
  marginBottom: "18px",
};

const logsListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  marginBottom: "18px",
};

const logRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  padding: "14px",
  borderRadius: "18px",
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
};

const mutedSmallStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "12px",
  marginTop: "5px",
};

const logStatusStyle = (allowed: boolean): React.CSSProperties => ({
  display: "inline-block",
  color: allowed ? "var(--success)" : "var(--danger)",
  fontWeight: 900,
  fontSize: "13px",
});

const linkButtonStyle: React.CSSProperties = {
  display: "inline-block",
  background: "linear-gradient(to right, #ef4444, #dc2626)",
  color: "white",
  borderRadius: "18px",
  padding: "14px 20px",
  fontWeight: 800,
  textDecoration: "none",
};

const quickLinksStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
};

const quickLinkStyle: React.CSSProperties = {
  background: "var(--panel-2)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "18px",
  padding: "16px",
  textDecoration: "none",
  fontWeight: 800,
};