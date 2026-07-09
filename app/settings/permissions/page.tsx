import PermissionsSettingsClient from "@/app/components/settings/PermissionsSettingsClient";
import PermissionGuard from "@/app/components/security/PermissionGuard";
import BGPageShell from "@/components/bodygate-ui/BGPageShell";

export default function PermissionsPage() {
  return (
    <PermissionGuard permission="manage_staff">
      <BGPageShell><PermissionsSettingsClient /></BGPageShell>
    </PermissionGuard>
  );
}
