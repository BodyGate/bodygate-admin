"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

type AccessLog = {
  id: string;
  allowed: boolean;
  created_at: string;
};

type Customer = {
  id: string;
  active: boolean;
  subscription_status: string | null;
};

export default function AnalyticsDashboard() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAnalytics() {
    setLoading(true);

    const { data: logsData } = await supabase
      .from("access_logs")
      .select("id, allowed, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    const { data: customersData } = await supabase
      .from("customers")
      .select("id, active, subscription_status");

    setLogs((logsData || []) as AccessLog[]);
    setCustomers((customersData || []) as Customer[]);

    setLoading(false);
  }

  useEffect(() => {
    loadAnalytics();

    const channel = supabase
      .channel("analytics_live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "access_logs",
        },
        (payload) => {
          setLogs((current) => [
            payload.new as AccessLog,
            ...current.slice(0, 999),
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();

    const todayLogs = logs.filter((log) => {
      const date = new Date(log.created_at);

      return (
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    });

    const weekLogs = logs.filter((log) => {
      const date = new Date(log.created_at);

      return (
        now.getTime() - date.getTime() <=
        7 * 24 * 60 * 60 * 1000
      );
    });

    const deniedLogs = logs.filter((log) => !log.allowed);

    const activeCustomers = customers.filter(
      (c) =>
        c.active &&
        c.subscription_status !== "expired"
    );

    return {
      todayAccesses: todayLogs.length,
      weeklyAccesses: weekLogs.length,
      deniedAccesses: deniedLogs.length,
      activeCustomers: activeCustomers.length,
    };
  }, [logs, customers]);

  const dailyChartData = useMemo(() => {
    const map: Record<string, number> = {};

    logs.forEach((log) => {
      const date = new Date(log.created_at);

      const key = date.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
      });

      map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map)
      .map(([day, accesses]) => ({
        day,
        accesses,
      }))
      .reverse()
      .slice(-14);
  }, [logs]);

  const hourlyChartData = useMemo(() => {
    const map: Record<string, number> = {};

    logs.forEach((log) => {
      const hour = new Date(log.created_at)
        .getHours()
        .toString()
        .padStart(2, "0");

      map[hour] = (map[hour] || 0) + 1;
    });

    return Array.from({ length: 24 }).map((_, i) => {
      const hour = i.toString().padStart(2, "0");

      return {
        hour: `${hour}:00`,
        accesses: map[hour] || 0,
      };
    });
  }, [logs]);

  if (loading) {
    return (
      <div style={loadingStyle}>
        Caricamento analytics...
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "22px" }}>
      <div style={cardsGrid}>
        <StatCard
          title="Accessi oggi"
          value={stats.todayAccesses.toString()}
          color="#22c55e"
        />

        <StatCard
          title="Accessi settimana"
          value={stats.weeklyAccesses.toString()}
          color="#3b82f6"
        />

        <StatCard
          title="Accessi negati"
          value={stats.deniedAccesses.toString()}
          color="#ef4444"
        />

        <StatCard
          title="Clienti attivi"
          value={stats.activeCustomers.toString()}
          color="#f59e0b"
        />
      </div>

      <div style={chartsGrid}>
        <div style={panelStyle}>
          <div style={sectionTitle}>
            Trend accessi ultimi 14 giorni
          </div>

          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="accesses"
                  stroke="#3b82f6"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={panelStyle}>
          <div style={sectionTitle}>
            Affluenza oraria palestra
          </div>

          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={hourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="accesses"
                  fill="#22c55e"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={panelStyle}>
        <div style={sectionTitle}>
          Attività realtime palestra
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          {logs.slice(0, 12).map((log) => (
            <div
              key={log.id}
              style={{
                background: "var(--bg-soft)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: "bold" }}>
                  {log.allowed
                    ? "Accesso consentito"
                    : "Accesso negato"}
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    color: "var(--muted)",
                    fontSize: "13px",
                  }}
                >
                  {new Date(
                    log.created_at
                  ).toLocaleString("it-IT")}
                </div>
              </div>

              <div
                style={{
                  color: log.allowed
                    ? "#22c55e"
                    : "#ef4444",
                  fontWeight: "bold",
                }}
              >
                {log.allowed ? "OK" : "DENIED"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: `1px solid ${color}33`,
        borderRadius: "22px",
        padding: "24px",
      }}
    >
      <div
        style={{
          color: "var(--muted)",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        {title.toUpperCase()}
      </div>

      <div
        style={{
          marginTop: "14px",
          fontSize: "46px",
          fontWeight: "bold",
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const cardsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(240px,1fr))",
  gap: "18px",
};

const chartsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "22px",
};

const panelStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "24px",
  padding: "24px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  marginBottom: "20px",
};

const loadingStyle: React.CSSProperties = {
  padding: "28px",
  color: "var(--muted)",
};