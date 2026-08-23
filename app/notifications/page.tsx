import { BGPageShell } from "@/components/bodygate-ui";
import NotificationCenterClient from "../components/notifications/NotificationCenterClient";

export default function NotificationsPage() {
  return (
    <BGPageShell>
      <NotificationCenterClient />
    </BGPageShell>
  );
}
