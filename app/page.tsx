"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "./lib/supabaseClient";

import DashboardHero from "./components/dashboard/DashboardHero";
import RealtimeStatusBar from "./components/dashboard/RealtimeStatusBar";
import TurnstilePanel from "./components/dashboard/TurnstilePanel";
import TodayAccessList from "./components/dashboard/TodayAccessList";
import SystemStatusPanel from "./components/dashboard/SystemStatusPanel";
import StatsCards from "./components/dashboard/StatsCards";
import QuickLinksPanel from "./components/dashboard/QuickLinksPanel";
import PresenceMonitor from "./components/dashboard/PresenceMonitor";
import AccessChartPanel from "./components/dashboard/AccessChartPanel";
import LiveActivityFeed from "./components/dashboard/LiveActivityFeed";

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

type Presence = {
  id: string;
  entered_at: string;
  badge_code: string | null;
  customers?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type ChartAccessLog = {
  id: string;
  access_time: string;
  was_allowed: boolean;
};

export default function DashboardHome() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [peopleInside, setPeopleInside] = useState<Presence[]>([]);
  const [chartLogs, setChartLogs] = useState<ChartAccessLog[]>([]);
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

  function last7DaysIso() {
    const d = new Date();
    d.setDate(d.getDate() - 6);
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
    } catch {
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

    const [
      { data: customersData },
      { data: subscriptionsData },
      { data: logsData },
      { data: presenceData },
      { data: chartLogsData },
    ] = await Promise.all([
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

      supabase
        .from("gym_presence")
        .select(`
          id,
          entered_at,
          badge_code,
          customers (
            first_name,
            last_name
          )
        `)
        .eq("is_inside", true)
        .order("entered_at", { ascending: false })
        .limit(20),

      supabase
        .from("customer_access_logs")
        .select("id, access_time, was_allowed")
        .gte("access_time", last7DaysIso())
        .order("access_time", { ascending: true }),
    ]);

    setCustomers((customersData || []) as Customer[]);
    setSubscriptions((subscriptionsData || []) as Subscription[]);
    setAccessLogs((logsData || []) as AccessLog[]);
    setPeopleInside((presenceData || []) as Presence[]);
    setChartLogs((chartLogsData || []) as ChartAccessLog[]);

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
    checkBridgeStatus();

    const interval = window.setInterval(() => {
      loadDashboard();
      checkBridgeStatus();
    }, 3000);

    const accessChannel = supabase
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

    const presenceChannel = supabase
      .channel("dashboard_gym_presence_live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gym_presence",
        },
        () => loadDashboard()
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(accessChannel);
      supabase.removeChannel(presenceChannel);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const activeCustomers = customers.filter((c) => c.is_active).length;

    const accessToday = accessLogs.filter(
      (log) => log.was_allowed
    ).length;

    const deniedToday = accessLogs.filter(
      (log) => !log.was_allowed
    ).length;

    return {
      totalCustomers: customers.length,
      activeCustomers,
      activeSubscriptions: subscriptions.length,
      accessToday,
      deniedToday,
    };
  }, [customers, subscriptions, accessLogs]);

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, index) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - index));
      d.setHours(0, 0, 0, 0);

      return {
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "2-digit",
        }),
        consentiti: 0,
        negati: 0,
      };
    });

    chartLogs.forEach((log) => {
      const key = new Date(log.access_time).toISOString().slice(0, 10);
      const day = days.find((item) => item.key === key);

      if (!day) {
        return;
      }

      if (log.was_allowed) {
        day.consentiti += 1;
      } else {
        day.negati += 1;
      }
    });

    return days.map(({ label, consentiti, negati }) => ({
      label,
      consentiti,
      negati,
    }));
  }, [chartLogs]);

  return (
    <div style={pageStyle}>
      <DashboardHero bridgeOnline={bridgeOnline} />

      <RealtimeStatusBar
        bridgeOnline={bridgeOnline}
        lockdown={lockdown}
        accessToday={stats.accessToday}
        deniedToday={stats.deniedToday}
      />

      <StatsCards stats={stats} />

      <div style={mainGridStyle}>
        <TurnstilePanel
          bridgeOnline={bridgeOnline}
          lockdown={lockdown}
          actionLoading={actionLoading}
          onOpen={() => callBridge("open-in", "open-in")}
          onStop={() => callBridge("stop", "stop")}
          onUnlock={() => callBridge("unlock", "unlock")}
        />

        <PresenceMonitor
          loading={loading}
          peopleInside={peopleInside}
        />
      </div>

      <div style={mainGridStyle}>
        <AccessChartPanel data={chartData} />

        <LiveActivityFeed
          loading={loading}
          accessLogs={accessLogs}
        />
      </div>

      <div style={mainGridStyle}>
        <SystemStatusPanel bridgeOnline={bridgeOnline} />

        <QuickLinksPanel />
      </div>

      <TodayAccessList
        loading={loading}
        accessLogs={accessLogs}
      />
    </div>
  );
}

const pageStyle: CSSProperties = {
  color: "var(--text)",
};

const mainGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "24px",
  marginBottom: "24px",
};