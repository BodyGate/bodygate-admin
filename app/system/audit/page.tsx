import { BGPageShell } from "@/components/bodygate-ui";
import AuditLogsClient from "@/app/components/system/AuditLogsClient";
import PermissionGuard from "@/app/components/security/PermissionGuard";

export default function AuditPage() {
  return (
    <PermissionGuard permission="manage_staff">
      <BGPageShell>
        <AuditLogsClient />
      </BGPageShell>
    </PermissionGuard>
  );
}
