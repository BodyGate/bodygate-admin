"use client";

import type { BodyGateNotification } from "./NotificationCenterClient";

export default function NotificationCard({ notification }: { notification: BodyGateNotification }) {
  const style = severityStyle[notification.severity];

  return (
    <article style={{ ...styles.card, borderColor: style.border, background: style.background }}>
      <div style={{ ...styles.icon, background: style.iconBg, color: style.color }}>{style.icon}</div>

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
    color: "#b5233c",
    border: "rgba(214,49,74,0.35)",
    background: "linear-gradient(178deg, rgba(214,49,74,0.06), var(--panel) 55%)",
    iconBg: "rgba(214,49,74,0.12)",
  },
  warning: {
    icon: "⚠",
    color: "#8f620c",
    border: "rgba(179,121,10,0.35)",
    background: "linear-gradient(178deg, rgba(179,121,10,0.07), var(--panel) 55%)",
    iconBg: "rgba(179,121,10,0.14)",
  },
  info: {
    icon: "i",
    color: "#2c50a8",
    border: "rgba(58,107,219,0.32)",
    background: "linear-gradient(178deg, rgba(58,107,219,0.06), var(--panel) 55%)",
    iconBg: "rgba(58,107,219,0.14)",
  },
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: "flex",
    gap: 16,
    padding: 18,
    borderRadius: 22,
    border: "1px solid",
    boxShadow: "0 1px 2px rgba(21,22,28,0.04), 0 12px 32px -12px rgba(21,22,28,0.1)",
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
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
    color: "var(--text)",
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
    color: "var(--muted)",
    lineHeight: 1.5,
  },
  meta: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    color: "var(--muted)",
    fontSize: 12,
    fontWeight: 700,
  },
};