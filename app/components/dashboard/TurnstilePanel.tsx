"use client";

type Props = {
  bridgeOnline: boolean;
  lockdown: boolean;
  actionLoading: string;
  onOpen: () => void;
  onStop: () => void;
  onUnlock: () => void;
};

export default function TurnstilePanel({
  bridgeOnline,
  lockdown,
  actionLoading,
  onOpen,
  onStop,
  onUnlock,
}: Props) {
  return (
    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <h2 style={sectionTitleStyle}>
            Controllo tornello
          </h2>

          <p style={sectionTextStyle}>
            Azioni rapide per reception e test accessi.
          </p>
        </div>

        <div
          style={
            bridgeOnline
              ? miniBadgeStyle
              : miniBadgeDangerStyle
          }
        >
          {bridgeOnline
            ? "Bridge online"
            : "Bridge offline"}
        </div>
      </div>

      <div style={buttonRowStyle}>
        <button
          style={primaryButtonStyle}
          onClick={onOpen}
          disabled={actionLoading !== ""}
        >
          {actionLoading === "open-in"
            ? "Apertura..."
            : "Apri tornello"}
        </button>

        <button
          style={warningButtonStyle}
          onClick={onStop}
          disabled={actionLoading !== ""}
        >
          {actionLoading === "stop"
            ? "Attivo..."
            : "Lockdown"}
        </button>

        <button
          style={secondaryButtonStyle}
          onClick={onUnlock}
          disabled={actionLoading !== ""}
        >
          {actionLoading === "unlock"
            ? "Sblocco..."
            : "Sblocca"}
        </button>
      </div>

      <div
        style={
          lockdown
            ? lockdownStyle
            : normalStyle
        }
      >
        {lockdown
          ? "STOP ATTIVO: aperture manuali bloccate. I badge validi continuano a funzionare."
          : "Sistema in modalità normale."}
      </div>
    </section>
  );
}

const panelStyle: React.CSSProperties = {
  background:
    "linear-gradient(180deg, #181818, #101010)",
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
  background:
    "linear-gradient(to right, #ef4444, #dc2626)",
};

const warningButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  background:
    "linear-gradient(to right, #f59e0b, #d97706)",
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
  border:
    "1px solid rgba(245,158,11,0.28)",
  color: "#fbbf24",
  fontSize: "13px",
  fontWeight: 800,
};

const normalStyle: React.CSSProperties = {
  marginTop: "18px",
  padding: "12px 14px",
  borderRadius: "16px",
  background: "rgba(34,197,94,0.10)",
  border:
    "1px solid rgba(34,197,94,0.25)",
  color: "var(--success)",
  fontSize: "13px",
  fontWeight: 800,
};