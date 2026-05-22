import PermissionsSettingsClient from "@/app/components/settings/PermissionsSettingsClient";
import PermissionGuard from "@/app/components/security/PermissionGuard";

export default function PermissionsPage() {
  return (
    <PermissionGuard permission="manage_staff">
      <PermissionsSettingsClient />
    </PermissionGuard>
  );
}