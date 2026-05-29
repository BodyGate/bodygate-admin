"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";

type AccessLog = {
  id: string;
  customer_id: string | null;
  badge_code: string | null;
  controller_code: string | null;
  reason: string | null;
  access_time: string | null;
  created_at: string | null;
  was_allowed?: boolean | null;
  allowed?: boolean | null;
};

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone?: string | null;
  is_active?: boolean | null;
};

type Subscription = {
  id: string;
  customer_id: string | null;
  ends_at: string | null;
  is_active: boolean | null;
};

type Payment = {
  id: string;
  amount: number | null;
  paid_at: string | null;
  created_at: string | null;
};

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function formatTime(value?: string | null) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEuro(value: number) {
  return value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}

function isAllowed(log: AccessLog) {
  if (typeof log.was_allowed === "boolean") return log.was_allowed;
  if (typeof log.allowed === "boolean") return log.allowed;
  return String(log.reason || "").toLowerCase().includes("consentito");
}

function customerName(customer?: Customer | null) {
  if (!customer) return "Cliente non associato";
  return `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Cliente";
}

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(24,24,27,0.96), rgba(12,12,13,0.96))",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 18px 44px rgba(0,0,0,0.22)",
};

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 46,
  padding: "0 18px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.07)",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 14,
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [query, setQuery] = useState("");
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);

  async function loadDashboard() {
    setLoading(true);

    const todayStart = startOfTodayISO();
    const todayEnd = endOfTodayISO();
    const next7 = addDaysISO(7);

    const [
      customersRes,
      logsRes,
      subscriptionsRes,
      paymentsRes,
      bridgeRes,
    ] = await Promise.allSettled([
      supabase
        .from("customers")
        .select("id, first_name, last_name, phone, is_active")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("customer_access_logs")
        .select("id, customer_id, badge_code, controller_code, reason, access_time, created_at, was_allowed")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("customer_subscriptions")
        .select("id, customer_id, ends_at, is_active")
        .lte("ends_at", next7)
        .order("ends_at", { ascending: true })
        .limit(50),
      supabase
        .from("customer_payments")
        .select("id, amount, paid_at, created_at")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
        .limit(200),
      fetch("/api/bridge/status").then((r) => r.json()),
    ]);

    if (customersRes.status === "fulfilled") {
      setCustomers((customersRes.value.data || []) as Customer[]);
    }

    if (logsRes.status === "fulfilled") {
      setLogs((logsRes.value.data || []) as AccessLog[]);
    }

    if (subscriptionsRes.status === "fulfilled") {
      setSubscriptions((subscriptionsRes.value.data || []) as Subscription[]);
    }

    if (paymentsRes.status === "fulfilled") {
      setPayments((paymentsRes.value.data || []) as Payment[]);
    }

    if (bridgeRes.status === "fulfilled") {
      setBridgeOnline(Boolean((bridgeRes.value as any)?.online || (bridgeRes.value as any)?.ok));
    } else {
      setBridgeOnline(false);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, 15000);
    return () => clearInterval(timer);
  }, []);

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const allowedToday = logs.filter(isAllowed).length;
  const deniedToday = logs.length - allowedToday;
  const activeCustomers = customers.filter((c) => c.is_active !== false).length;
  const expiringSubscriptions = subscriptions.filter((s) => s.is_active !== false).length;
  const todayRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter((c) => {
        const full = `${c.first_name || ""} ${c.last_name || ""} ${c.phone || ""}`.toLowerCase();
        return full.includes(q);
      })
      .slice(0, 8);
  }, [query, customers]);

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section
        style={{
          ...cardStyle,
          padding: 28,
          background:
            "radial-gradient(circle at top left, rgba(239,68,68,0.22), transparent 34%), linear-gradient(180deg, rgba(24,24,27,0.96), rgba(10,10,12,0.96))",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div
              style={{
                color: "#f87171",
                fontWeight: 950,
                letterSpacing: "2.5px",
                fontSize: 13,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              BodyGate Reception
            </div>
            <h1 style={{ color: "#fff", fontSize: 42, margin: 0, letterSpacing: "-1.7px" }}>
              Dashboard operativa
            </h1>
            <p style={{ color: "#cbd5e1", margin: "10px 0 0", fontSize: 16 }}>
              Cerca clienti, rinnova abbonamenti, controlla accessi e gestisci la reception.
            </p>
          </div>

          <div
            style={{
              alignSelf: "flex-start",
              border: `1px solid ${bridgeOnline ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.35)"}`,
              background: bridgeOnline ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
              color: bridgeOnline ? "#86efac" : "#f87171",
              borderRadius: 999,
              padding: "12px 18px",
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            {bridgeOnline ? "Bridge online" : "Bridge offline"}
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        {[
          ["Accessi oggi", String(allowedToday), "Ingressi autorizzati"],
          ["Negati oggi", String(deniedToday), "Accessi bloccati"],
          ["Scadenze 7 giorni", String(expiringSubscriptions), "Abbonamenti in scadenza"],
          ["Incassi oggi", formatEuro(todayRevenue), "Pagamenti registrati"],
        ].map(([title, value, subtitle]) => (
          <div key={title} style={cardStyle}>
            <div style={{ color: "#cbd5e1", fontWeight: 900, fontSize: 14 }}>{title}</div>
            <div style={{ color: "#fff", fontSize: 42, fontWeight: 950, marginTop: 12 }}>{value}</div>
            <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>{subtitle}</div>
          </div>
        ))}
      </section>

      <section style={{ ...cardStyle, display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center" }}>
          <div>
            <h2 style={{ color: "#fff", margin: 0, fontSize: 24 }}>Ricerca cliente rapida</h2>
            <p style={{ color: "#94a3b8", margin: "6px 0 0" }}>
              Cerca per nome, cognome o telefono. Poi apri subito la scheda cliente.
            </p>
          </div>
          <Link href="/customers" style={{ ...buttonStyle, background: "#ef4444" }}>
            Elenco clienti
          </Link>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca cliente..."
          style={{
            width: "100%",
            minHeight: 54,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            padding: "0 18px",
            fontSize: 16,
            outline: "none",
          }}
        />

        {query.trim() ? (
          <div style={{ display: "grid", gap: 10 }}>
            {filteredCustomers.length ? (
              filteredCustomers.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  style={{
                    textDecoration: "none",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                    padding: "13px 15px",
                    borderRadius: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 900 }}>{customerName(customer)}</span>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{customer.phone || "Apri scheda"}</span>
                </Link>
              ))
            ) : (
              <div style={{ color: "#94a3b8" }}>Nessun cliente trovato.</div>
            )}
          </div>
        ) : null}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 18,
        }}
      >
        <div style={cardStyle}>
          <h2 style={{ color: "#fff", margin: 0, fontSize: 24 }}>Ultimi accessi</h2>
          <p style={{ color: "#94a3b8", margin: "6px 0 18px" }}>
            Aggiornamento automatico ogni 15 secondi.
          </p>

          <div style={{ display: "grid", gap: 10 }}>
            {logs.length ? (
              logs.slice(0, 10).map((log) => {
                const c = log.customer_id ? customerMap.get(log.customer_id) : null;
                const ok = isAllowed(log);

                return (
                  <div
                    key={log.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: ok ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.08)",
                      borderRadius: 14,
                      padding: "12px 14px",
                      display: "grid",
                      gridTemplateColumns: "70px 1fr auto",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ color: "#cbd5e1", fontWeight: 900 }}>
                      {formatTime(log.access_time || log.created_at)}
                    </div>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 900 }}>
                        {customerName(c)}
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>
                        {log.controller_code || log.badge_code || "Credenziale"} · {log.reason || ""}
                      </div>
                    </div>
                    <div
                      style={{
                        color: ok ? "#86efac" : "#fca5a5",
                        fontWeight: 950,
                      }}
                    >
                      {ok ? "Consentito" : "Negato"}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ color: "#94a3b8" }}>
                {loading ? "Caricamento accessi..." : "Nessun accesso oggi."}
              </div>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={{ color: "#fff", margin: 0, fontSize: 24 }}>Azioni rapide</h2>
          <p style={{ color: "#94a3b8", margin: "6px 0 18px" }}>
            Le operazioni più frequenti della reception.
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            <Link href="/customers/new" style={{ ...buttonStyle, background: "#ef4444" }}>
              + Nuovo cliente
            </Link>
            <Link href="/customers" style={buttonStyle}>
              Rinnova abbonamento
            </Link>
            <Link href="/badges" style={buttonStyle}>
              Gestisci credenziali
            </Link>
            <Link href="/access-logs" style={buttonStyle}>
              Log accessi
            </Link>
            <Link href="/payments" style={buttonStyle}>
              Incassi e pagamenti
            </Link>
          </div>

          <div
            style={{
              marginTop: 18,
              padding: 14,
              borderRadius: 16,
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.18)",
              color: "#bfdbfe",
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            Clienti attivi registrati: <b>{activeCustomers}</b>
          </div>
        </div>
      </section>
    </div>
  );
}
