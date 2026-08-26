"use client";

import type { BodyGateNotification } from "./NotificationCenterClient";

export default function NotificationCard({ notification }: { notification: BodyGateNotification }) {
  const style = severityStyle[notification.severity];

  return (
    <article style={{ ...styles.card, borderColor: style.border, background: style.background }}>
      <div style={{ ...styles.icon, background: style.iconBg }}>{style.icon}</div>

      <div style={styles.content}>
        <div style={styles.topRow}>
          <h3 style={styles.title}>{notification.title}</h3>
          <span style={{ ...styles.badge, color: style.color, borderColor: style.border }}>
            {notification.severity.toUpperCase()}
          </span>
        </div>

        <p style={styles.message}>{notification.message}</p>

        <div style={styles.meta}>
          <span>{notification.type}</span>
          {notification.customerName && <span>{notification.customerName}</span>}
          {notification.createdAt && <span>{new Date(notification.createdAt).toLocaleString("it-IT")}</span>}
        </div>
      </div>
    </article>
  );
}

const severityStyle = {
  critical: {
    icon: "!",
    color: "#fecaca",
    border: "rgba(248,113,113,0.45)",
    background: "linear-gradient(135deg, rgba(61,43,153,0.45), rgba(15,23,42,0.92))",
    iconBg: "rgba(91,61,245,0.28)",
  },
  warning: {
    icon: "⚠",
    color: "#fde68a",
    border: "rgba(251,191,36,0.45)",
    background: "linear-gradient(135deg, rgba(120,53,15,0.38), rgba(15,23,42,0.92))",
    iconBg: "rgba(245,158,11,0.24)",
  },
  info: {
    icon: "i",
    color: "#bfdbfe",
    border: "rgba(96,165,250,0.42)",
    background: "linear-gradient(135deg, rgba(30,64,175,0.30), rgba(15,23,42,0.92))",
    iconBg: "rgba(59,130,246,0.22)",
  },
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: "flex",
    gap: 16,
    padding: 18,
    borderRadius: 22,
    border: "1px solid",
    boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    color: "#fff",
  },
  content: {
    flex: 1,
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
  },
  badge: {
    fontSize: 11,
    border: "1px solid",
    borderRadius: 999,
    padding: "5px 9px",
    fontWeight: 900,
  },
  message: {
    margin: "8px 0 12px",
    color: "#cbd5e1",
    lineHeight: 1.5,
  },
  meta: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },
};