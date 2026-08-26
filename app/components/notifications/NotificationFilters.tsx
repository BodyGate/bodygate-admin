"use client";

import type { NotificationSeverity } from "./NotificationCenterClient";

type Filter = "all" | NotificationSeverity;

export default function NotificationFilters({
  activeFilter,
  onChange,
}: {
  activeFilter: Filter;
  onChange: (filter: Filter) => void;
}) {
  const filters: { label: string; value: Filter }[] = [
    { label: "Tutte", value: "all" },
    { label: "Critiche", value: "critical" },
    { label: "Warning", value: "warning" },
    { label: "Info", value: "info" },
  ];

  return (
    <div style={styles.wrapper}>
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          style={{
            ...styles.button,
            ...(activeFilter === filter.value ? styles.active : {}),
          }}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 20,
  },
  button: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.82)",
    color: "#94a3b8",
    padding: "10px 14px",
    borderRadius: 14,
    cursor: "pointer",
    fontWeight: 800,
  },
  active: {
    background: "rgba(91,61,245,0.18)",
    color: "#fff",
    borderColor: "rgba(248,113,113,0.45)",
  },
};