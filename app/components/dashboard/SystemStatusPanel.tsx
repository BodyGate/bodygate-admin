"use client";

type Props = {
  bridgeOnline: boolean;
};

export default function SystemStatusPanel({ bridgeOnline }: Props) {
  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>Stato sistema</h2>

      <p style={sectionTextStyle}>
        Monitoraggio dei servizi principali BodyGate.
      </p>

      <div style={statusListStyle}>
        <StatusRow
          label="Bridge tornello"
          value={bridgeOnline ? "Online" : "Offline"}
          ok={bridgeOnline}
        />

        <StatusRow
          label="Controller accessi"
          value={bridgeOnline ? "Online" : "Da verificare"}
          ok={bridgeOnline}
        />

        <StatusRow label="Database Supabase" value="Online" ok />

        <StatusRow label="Realtime dashboard" value="Attivo" ok />
      </div>
    </section>
  );
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div style={statusRowStyle}>
      <span style={{ color: "var(--muted)" }}>{label}</span>

      <span
        style={{
          color: ok ? "var(--success)" : "var(--danger)",
          fontWeight: 800,
        }}
      >
        {value}
      </span>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "28px",
  boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
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