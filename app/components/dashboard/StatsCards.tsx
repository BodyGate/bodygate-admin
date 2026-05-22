"use client";

type Stats = {
  accessToday: number;
  deniedToday: number;
  totalCustomers: number;
  activeCustomers: number;
  activeSubscriptions: number;
};

export default function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div style={gridStatsStyle}>
      <Card
        title="Accessi oggi"
        value={String(stats.accessToday)}
        note="Ingressi autorizzati"
      />

      <Card
        title="Accessi negati"
        value={String(stats.deniedToday)}
        note="Badge bloccati o non validi"
      />

      <Card
        title="Clienti registrati"
        value={String(stats.totalCustomers)}
        note={`${stats.activeCustomers} clienti attivi`}
      />

      <Card
        title="Abbonamenti attivi"
        value={String(stats.activeSubscriptions)}
        note="Validi oggi"
      />
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
      <div>
        <div style={cardTitleStyle}>{title}</div>
        <div style={cardValueStyle}>{value}</div>
      </div>

      <div style={cardNoteStyle}>{note}</div>
    </div>
  );
}

const gridStatsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
  gap: "18px",
  marginBottom: "24px",
};

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "26px",
  minHeight: "160px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
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