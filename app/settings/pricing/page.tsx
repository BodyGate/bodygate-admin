import PricingSettingsClient from "@/app/components/settings/PricingSettingsClient";
import PermissionGuard from "@/app/components/security/PermissionGuard";

export default function PricingPage() {
  return (
    <PermissionGuard permission="manage_payments">
      <PricingSettingsClient />
    </PermissionGuard>
  );
}