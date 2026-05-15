type Props = {
  name: string;
  badge: string;
  allowed: boolean;
  time: string;
};

export default function ReceptionAccessCard({
  name,
  badge,
  allowed,
  time,
}: Props) {
  return (
    <div
      style={{
        background: allowed
          ? "rgba(34,197,94,0.10)"
          : "rgba(239,68,68,0.10)",
        border: allowed
          ? "1px solid rgba(34,197,94,0.25)"
          : "1px solid rgba(239,68,68,0.25)",
        borderRadius: "20px",
        padding: "18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "20px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "20px",
            fontWeight: "bold",
          }}
        >
          {name}
        </div>

        <div
          style={{
            marginTop: "6px",
            color: "var(--muted)",
            fontSize: "13px",
          }}
        >
          Badge: {badge}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div
          style={{
            color: allowed ? "#22c55e" : "#ef4444",
            fontWeight: "bold",
            fontSize: "14px",
          }}
        >
          {allowed ? "ACCESSO CONSENTITO" : "ACCESSO NEGATO"}
        </div>

        <div
          style={{
            marginTop: "4px",
            color: "var(--muted)",
            fontSize: "12px",
          }}
        >
          {time}
        </div>
      </div>
    </div>
  );
}