"use client";

import { BGCard, BGStack, BGStatusBadge } from "@/components/bodygate-ui";
import type { BodyGateNotification, NotificationSeverity } from "./NotificationCenterClient";

const severityStyle = {
  critical: { variant: "danger", tone: "danger" },
  warning: { variant: "warning", tone: "warning" },
  info: { variant: "default", tone: "info" },
} as const satisfies Record<NotificationSeverity, { variant: "danger" | "warning" | "default"; tone: "danger" | "warning" | "info" }>;

export default function NotificationCard({ notification }: { notification: BodyGateNotification }) {
  const style = severityStyle[notification.severity];

  return (
    <BGCard variant={style.variant}>
      <BGStack>
        <BGStack direction="row" spread>
          <h3>{notification.title}</h3>
          <BGStatusBadge tone={style.tone}>{notification.severity.toUpperCase()}</BGStatusBadge>
        </BGStack>

        <p>{notification.message}</p>

        <BGStack direction="row">
          <BGStatusBadge>{notification.type}</BGStatusBadge>
          {notification.customerName && <BGStatusBadge>{notification.customerName}</BGStatusBadge>}
          {notification.createdAt && (
            <BGStatusBadge>{new Date(notification.createdAt).toLocaleString("it-IT")}</BGStatusBadge>
          )}
        </BGStack>
      </BGStack>
    </BGCard>
  );
}
