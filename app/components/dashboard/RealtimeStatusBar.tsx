"use client";

import { useEffect, useState } from "react";

type Props = {
  bridgeOnline: boolean;
  lockdown: boolean;
  accessToday: number;
  deniedToday: number;
};

export default function RealtimeStatusBar({
  bridgeOnline,
  lockdown,
  accessToday,
  deniedToday,
}: Props) {
  const [now, setNow] = useState("");

  useEffect(() => {
    function updateClock() {
      setNow(new Date().toLocaleString("it-IT"));
    }

    updateClock();

    const interval = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div style={barStyle}>
      <div style={itemStyle}>
        <span style={labelStyle}>Ora sistema</span>
        <strong>{now || "-"}</strong>
      </div>

      <div style={itemStyle}>
        <span style={labelStyle}>Bridge</span>
        <strong style={{ color: bridgeOnline ? "var(--success)" : "var(--danger)" }}>
          {bridgeOnline ? "Online" : "Offline"}
        </strong>
      </div>

      <div style={itemStyle}>
        <span style={labelStyle}>Modalità</span>
        <strong style={{ color: lockdown ? "#fbbf24" : "var(--success)" }}>
          {lockdown ? "Stop attivo" : "Normale"}
        </strong>
      </div>

      <div style={itemStyle}>
        <span style={labelStyle}>Accessi oggi</span>
        <strong>{accessToday}</strong>
      </div>

      <div style={itemStyle}>
        <span style={labelStyle}>Negati oggi</span>
        <strong style={{ color: deniedToday > 0 ? "var(--danger)" : "var(--success)" }}>
          {deniedToday}
        </strong>
      </div>
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(120px, 1fr))",
  gap: "12px",
  marginBottom: "24px",
};

const itemStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #141414, #0d0d0d)",
  border: "1px solid var(--border)",
  borderRadius: "18px",
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const labelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};