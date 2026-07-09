import AuditLogsClient from "@/app/components/system/AuditLogsClient";
import PermissionGuard from "@/app/components/security/PermissionGuard";
import BGPageShell from "@/components/bodygate-ui/BGPageShell";

export default function AuditPage() {
  return (
    <PermissionGuard permission="manage_staff">
      <BGPageShell>
        <AuditLogsClient />
      </BGPageShell>
    </PermissionGuard>
  );
}
