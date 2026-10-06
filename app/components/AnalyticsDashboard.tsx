"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

import {
  BGEmptyState,
  BGSection,
  BGSplitGrid,
  BGStatCard,
  BGStatGrid,
  BGStatusBadge,
  BGTable,
} from "@/components/bodygate-ui";

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

    const response = await fetch("/api/analytics/summary", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      console.error("Errore caricamento analytics:", result?.error);
      setLoading(false);
      return;
    }

    setLogs((result.logs || []) as AccessLog[]);
    setCustomers((result.customers || []) as Customer[]);

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
    return <BGEmptyState title="Caricamento analytics..." />;
  }

  return (
    <>
      <BGStatGrid>
        <BGStatCard
          label="Accessi oggi"
          value={stats.todayAccesses}
          tone="green"
        />
        <BGStatCard
          label="Accessi settimana"
          value={stats.weeklyAccesses}
          tone="blue"
        />
        <BGStatCard
          label="Accessi negati"
          value={stats.deniedAccesses}
          tone="red"
        />
        <BGStatCard
          label="Clienti attivi"
          value={stats.activeCustomers}
          tone="yellow"
        />
      </BGStatGrid>

      <BGSplitGrid>
        <BGSection title="Trend accessi ultimi 14 giorni">
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
        </BGSection>

        <BGSection title="Affluenza oraria palestra">
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
        </BGSection>
      </BGSplitGrid>

      <BGSection title="Attività realtime palestra">
        {logs.length === 0 ? (
          <BGEmptyState title="Nessun accesso registrato." />
        ) : (
          <BGTable wide aria-label="Ultimi accessi palestra">
            <thead>
              <tr>
                <th>Esito</th>
                <th>Data e ora</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 12).map((log) => (
                <tr key={log.id}>
                  <td>
                    <strong>
                      {log.allowed ? "Accesso consentito" : "Accesso negato"}
                    </strong>
                  </td>
                  <td>{new Date(log.created_at).toLocaleString("it-IT")}</td>
                  <td>
                    <BGStatusBadge tone={log.allowed ? "success" : "danger"}>
                      {log.allowed ? "OK" : "DENIED"}
                    </BGStatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </BGTable>
        )}
      </BGSection>
    </>
  );
}
