import { BGPageShell } from "@/components/bodygate-ui";
import PaymentsClient from "@/app/components/payments/PaymentsClient";
import PermissionGuard from "@/app/components/security/PermissionGuard";

export default function PaymentsPage() {
  return (
    <PermissionGuard permission="view_payments">
      <BGPageShell>
        <PaymentsClient />
      </BGPageShell>
    </PermissionGuard>
  );
}
