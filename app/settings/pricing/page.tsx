import { BGPageShell } from "@/components/bodygate-ui";
import PricingSettingsClient from "@/app/components/settings/PricingSettingsClient";
import PermissionGuard from "@/app/components/security/PermissionGuard";

export default function PricingPage() {
  return (
    <PermissionGuard permission="manage_payments">
      <BGPageShell><PricingSettingsClient /></BGPageShell>
    </PermissionGuard>
  );
}
