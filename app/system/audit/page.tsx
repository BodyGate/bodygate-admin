import AuditLogsClient from "@/app/components/system/AuditLogsClient";
import PermissionGuard from "@/app/components/security/PermissionGuard";

export default function AuditPage() {
  return (
    <PermissionGuard permission="manage_staff">
      <AuditLogsClient />
    </PermissionGuard>
  );
}