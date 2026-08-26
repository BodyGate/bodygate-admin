"use client";

type Props = {
  bridgeOnline: boolean;
};

export default function DashboardHero({ bridgeOnline }: Props) {
  return (
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
  );
}

const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "24px",
  marginBottom: "30px",
  padding: "30px",
  borderRadius: "30px",
  background:
    "radial-gradient(circle at top left, rgba(91,61,245,0.20), transparent 35%), linear-gradient(180deg, #181818, #101010)",
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
  background: "rgba(214,49,74,0.1)",
  color: "var(--danger)",
  border: "1px solid rgba(214,49,74,0.25)",
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