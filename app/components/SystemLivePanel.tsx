"use client";

import { useEffect, useState } from "react";

export default function SystemLivePanel() {
  const [time, setTime] = useState("");
  const [lastBadge] = useState("9340243");
  const [lastOpen, setLastOpen] = useState("-");
  const [opening, setOpening] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString("it-IT"));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  async function openTurnstile() {
    setOpening(true);
    setMessage("Invio comando apertura...");

    try {
      const response = await fetch("/api/turnstile/open", {
        method: "POST",
      });

      const result = await response.json();

      if (result.ok) {
        setLastOpen(new Date().toLocaleTimeString("it-IT"));
        setMessage("Tornello aperto correttamente.");
      } else {
        setMessage(result.message || "Apertura non riuscita.");
      }
    } catch {
      setMessage("Errore durante la richiesta di apertura.");
    } finally {
      setOpening(false);
    }
  }

  async function checkExpiredSubscriptions() {
    setChecking(true);
    setMessage("Controllo abbonamenti scaduti in corso...");

    try {
      const response = await fetch("/api/subscriptions/check-expired", {
        method: "POST",
      });

      const result = await response.json();

      if (result.ok) {
        setMessage(
          `Controllo completato. Clienti bloccati: ${result.expired_count}.`
        );
      } else {
        setMessage(result.message || "Errore durante il controllo scadenze.");
      }
    } catch {
      setMessage("Errore durante il controllo abbonamenti.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>Live System Monitor</div>
          <div style={subtitleStyle}>
            Monitoraggio realtime della piattaforma BodyGate.
          </div>
        </div>

        <div style={liveBadgeStyle}>LIVE</div>
      </div>

      <div style={gridStyle}>
        <InfoBox label="ORARIO SISTEMA" value={time} />
        <InfoBox label="ULTIMO BADGE" value={lastBadge} />
        <InfoBox label="ULTIMA APERTURA" value={lastOpen} />
      </div>

      <div style={buttonsRowStyle}>
        <button
          onClick={openTurnstile}
          disabled={opening}
          style={{
            ...primaryButtonStyle,
            opacity: opening ? 0.6 : 1,
            cursor: opening ? "not-allowed" : "pointer",
          }}
        >
          {opening ? "Apertura..." : "Apri tornello"}
        </button>

        <button style={secondaryButtonStyle}>Ping controller</button>

        <button style={secondaryButtonStyle}>Refresh logs</button>

        <button
          onClick={checkExpiredSubscriptions}
          disabled={checking}
          style={{
            ...warningButtonStyle,
            opacity: checking ? 0.6 : 1,
            cursor: checking ? "not-allowed" : "pointer",
          }}
        >
          {checking ? "Controllo..." : "Controlla scadenze"}
        </button>
      </div>

      {message && <div style={messageStyle}>{message}</div>}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={boxStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "24px",
  padding: "28px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "28px",
  gap: "18px",
  flexWrap: "wrap",
};

const titleStyle: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: "bold",
};

const subtitleStyle: React.CSSProperties = {
  marginTop: "6px",
  color: "var(--muted)",
};

const liveBadgeStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: "999px",
  background: "rgba(34,197,94,0.12)",
  color: "#22c55e",
  fontWeight: "bold",
  border: "1px solid rgba(34,197,94,0.25)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
  gap: "18px",
};

const boxStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "18px",
  padding: "20px",
};

const labelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "13px",
};

const valueStyle: React.CSSProperties = {
  marginTop: "10px",
  fontSize: "30px",
  fontWeight: "bold",
};

const buttonsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "14px",
  marginTop: "26px",
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  borderRadius: "14px",
  padding: "14px 18px",
  fontWeight: "bold",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "14px 18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const warningButtonStyle: React.CSSProperties = {
  background: "rgba(245,158,11,0.14)",
  color: "#f59e0b",
  border: "1px solid rgba(245,158,11,0.35)",
  borderRadius: "14px",
  padding: "14px 18px",
  fontWeight: "bold",
};

const messageStyle: React.CSSProperties = {
  marginTop: "22px",
  padding: "14px 16px",
  borderRadius: "14px",
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  fontWeight: 600,
};