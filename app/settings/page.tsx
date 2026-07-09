import PermissionGuard from "../components/security/PermissionGuard";
import SettingsPageClient from "./components/SettingsPageClient";
import BGPageShell from "@/components/bodygate-ui/BGPageShell";

export default function SettingsPage() {
  return (
    <PermissionGuard permission="manage_staff">
      <BGPageShell>
        <SettingsPageClient />
      </BGPageShell>
    </PermissionGuard>
  );
}
