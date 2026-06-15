import PermissionGuard from "../components/security/PermissionGuard";
import SettingsPageClient from "./components/SettingsPageClient";

export default function SettingsPage() {
  return (
    <PermissionGuard permission="manage_staff">
      <SettingsPageClient />
    </PermissionGuard>
  );
}
