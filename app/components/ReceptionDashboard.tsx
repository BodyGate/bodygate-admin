"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function ReceptionDashboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function loadData() {
    setLoading(true);

    const today = todayString();
    const in30Days = addDays(30);

    const [
      { data: customersData },
      { data: logsData },
      { data: certificatesData },
    ] = await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, full_name, first_name, last_name, active, subscription_status, subscription_expiry"
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("access_logs")
        .select(
          `
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
        `
        )
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(30),

      supabase
        .from("medical_certificates")
        .select(
          `
          id,
          customer_id,
          valid_from,
          valid_until,
          customers (
            full_name,
            first_name,
            last_name
          )
        `
        )
        .gte("valid_until", today)
        .lte("valid_until", in30Days)
        .order("valid_until", { ascending: true })
        .limit(20),
    ]);

    setCustomers((customersData || []) as Customer[]);
    setLogs((logsData || []) as AccessLog[]);
    setCertificates((certificatesData || []) as Certificate[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

    const blockedCustomers = customers.filter((customer) => !customer.active)
      .length;

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

  const alerts = useMemo(() => {
    const items: {
      title: string;
      text: string;
      tone: "danger" | "warning" | "success";
      href?: string;
    }[] = [];

    if (stats.deniedToday > 0) {
      items.push({
        title: "Accessi negati oggi",
        text: `${stats.deniedToday} tentativi negati. Controlla badge, abbonamenti e certificati.`,
        tone: "danger",
        href: "/access-logs",
      });
    }

    if (stats.certificatesExpiring > 0) {
      items.push({
        title: "Certificati in scadenza",
        text: `${stats.certificatesExpiring} certificati medici scadono entro 30 giorni.`,
        tone: "warning",
      });
    }

    if (stats.expiredSubscriptions > 0) {
      items.push({
        title: "Abbonamenti da verificare",
        text: `${stats.expiredSubscriptions} clienti risultano scaduti, bloccati o senza abbonamento valido.`,
        tone: "warning",
      });
    }

    if (stats.blockedCustomers > 0) {
      items.push({
        title: "Clienti bloccati",
        text: `${stats.blockedCustomers} clienti hanno accesso disattivato.`,
        tone: "danger",
      });
    }

    if (items.length === 0) {
      items.push({
        title: "Nessuna criticità",
        text: "Reception regolare: nessun alert operativo al momento.",
        tone: "success",
      });
    }

    return items;
  }, [stats]);

  return (
    <main style={pageStyle}>
      <div style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>BodyGate Reception</div>
          <h1 style={titleStyle}>Reception live</h1>
          <p style={subtitleStyle}>
            Monitor realtime per accessi, clienti, certificati e abbonamenti.
          </p>
        </div>

        <div style={liveBadgeStyle}>
          <span style={dotStyle} />
          Live
        </div>
      </div>

      <div style={alertsGridStyle}>
        {alerts.map((alert, index) => (
          <AlertCard key={index} {...alert} />
        ))}
      </div>

      <div style={gridStyle}>
        <Card
          title="Accessi oggi"
          value={String(stats.accessToday)}
          note="Ingressi autorizzati"
        />
        <Card
          title="Accessi negati"
          value={String(stats.deniedToday)}
          note="Oggi"
        />
        <Card
          title="Certificati in scadenza"
          value={String(stats.certificatesExpiring)}
          note="Prossimi 30 giorni"
        />
        <Card
          title="Abbonamenti scaduti"
          value={String(stats.expiredSubscriptions)}
          note={`${stats.blockedCustomers} clienti bloccati`}
        />
      </div>

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Ultimi accessi</h2>
              <p style={sectionTextStyle}>
                Eventi ricevuti oggi dal tornello.
              </p>
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
          <h2 style={sectionTitleStyle}>Certificati in scadenza</h2>
          <p style={sectionTextStyle}>
            Certificati medici con scadenza entro 30 giorni.
          </p>

          {loading ? (
            <div style={emptyStyle}>Caricamento certificati...</div>
          ) : certificates.length === 0 ? (
            <div style={emptyStyle}>Nessun certificato in scadenza.</div>
          ) : (
            <div style={listStyle}>
              {certificates.map((cert) => {
                const customerName = cert.customers
                  ? getName(cert.customers)
                  : "Cliente";

                return (
                  <div key={cert.id} style={rowStyle}>
                    <div>
                      <div style={rowTitleStyle}>{customerName}</div>
                      <div style={rowMetaStyle}>
                        Scade il{" "}
                        {new Date(
                          `${cert.valid_until}T12:00:00`
                        ).toLocaleDateString("it-IT")}
                      </div>
                    </div>

                    <Link
                      href={`/customers/${cert.customer_id}`}
                      style={smallLinkStyle}
                    >
                      Apri
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
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

const alertsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
  gap: "18px",
  marginBottom: "24px",
};

const mainGridStyle: React.CSSProperties = {
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

const smallLinkStyle: React.CSSProperties = {
  color: "white",
  background: "var(--accent)",
  padding: "10px 14px",
  borderRadius: "14px",
  textDecoration: "none",
  fontWeight: 800,
  whiteSpace: "nowrap",
};