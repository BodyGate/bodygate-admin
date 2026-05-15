type Props = {
  title: string;
  value: string;
  status?: "online" | "offline" | "warning";
};

export default function SystemStatusCard({
  title,
  value,
  status = "online",
}: Props) {
  const colors = {
    online: {
      dot: "#22c55e",
      bg: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.25)",
    },
    offline: {
      dot: "#ef4444",
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.25)",
    },
    warning: {
      dot: "#f59e0b",
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.25)",
    },
  };

  const current = colors[status];

  return (
    <div
      style={{
        background: "var(--panel)",
        border: `1px solid ${current.border}`,
        borderRadius: "20px",
        padding: "22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "999px",
            background: current.dot,
            boxShadow: `0 0 12px ${current.dot}`,
          }}
        />

        <div
          style={{
            color: "var(--muted)",
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          {title.toUpperCase()}
        </div>
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          color: "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}