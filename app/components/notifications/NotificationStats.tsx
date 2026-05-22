"use client";

import type { BodyGateNotification } from "./NotificationCenterClient";

export default function NotificationStats({ notifications }: { notifications: BodyGateNotification[] }) {
  const total = notifications.length;
  const critical = notifications.filter((n) => n.severity === "critical").length;
  const warning = notifications.filter((n) => n.severity === "warning").length;
  const info = notifications.filter((n) => n.severity === "info").length;

  const cards = [
    { label: "Totale alert", value: total },
    { label: "Critici", value: critical },
    { label: "Warning", value: warning },
    { label: "Info", value: info },
  ];

  return (
    <section style={styles.grid}>
      {cards.map((card) => (
        <div key={card.label} style={styles.card}>
          <p style={styles.label}>{card.label}</p>
          <strong style={styles.value}>{card.value}</strong>
        </div>
      ))}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
  },
  card: {
    padding: 18,
    borderRadius: 22,
    background: "rgba(15,23,42,0.86)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
  },
  label: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
  },
  value: {
    display: "block",
    marginTop: 8,
    fontSize: 32,
    color: "#fff",
  },
};