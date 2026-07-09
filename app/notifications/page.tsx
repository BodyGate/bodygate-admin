import NotificationCenterClient from "../components/notifications/NotificationCenterClient";
import BGPageShell from "@/components/bodygate-ui/BGPageShell";

export default function NotificationsPage() {
  return (
    <BGPageShell>
      <NotificationCenterClient />
    </BGPageShell>
  );
}
