"use client";

import { BGStatCard, BGStatGrid } from "@/components/bodygate-ui";
import type { BodyGateNotification } from "./NotificationCenterClient";

export default function NotificationStats({ notifications }: { notifications: BodyGateNotification[] }) {
  const total = notifications.length;
  const critical = notifications.filter((n) => n.severity === "critical").length;
  const warning = notifications.filter((n) => n.severity === "warning").length;
  const info = notifications.filter((n) => n.severity === "info").length;

  return (
    <BGStatGrid>
      <BGStatCard label="Totale alert" value={total} />
      <BGStatCard label="Critici" value={critical} tone="red" />
      <BGStatCard label="Warning" value={warning} tone="yellow" />
      <BGStatCard label="Info" value={info} tone="blue" />
    </BGStatGrid>
  );
}
