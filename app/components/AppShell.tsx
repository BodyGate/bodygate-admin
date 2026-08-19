"use client";

import { usePathname } from "next/navigation";
import { PlatinumAppShell } from "@/components/bodygate-ui";
import { useCurrentPermissions } from "../hooks/useCurrentPermissions";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isReceiptPage =
    pathname.startsWith("/customers/") && pathname.includes("/receipt/");
  const isContractPrintPage =
    pathname.startsWith("/customers/") && pathname.endsWith("/contract/print");

  const isPublicStandalonePage =
    pathname.startsWith("/mobile") ||
    pathname.startsWith("/staff-mobile") ||
    pathname.startsWith("/login") ||
    isReceiptPage ||
    isContractPrintPage;

  const isIsolatedUiLab = pathname.startsWith("/ui-lab/platinum");

  if (isIsolatedUiLab) {
    return children;
  }

  if (isPublicStandalonePage) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: isReceiptPage || isContractPrintPage ? "#ffffff" : "#050505",
        }}
      >
        {children}
      </main>
    );
  }

  return <OperationalShell>{children}</OperationalShell>;
}

function OperationalShell({ children }: { children: React.ReactNode }) {
  const { loading: permissionsLoading, hasPermission } = useCurrentPermissions();

  return (
    <PlatinumAppShell
      runtime
      systemStatus="Da verificare"
      paymentsAccess={
        permissionsLoading ? "loading" : hasPermission("view_payments") ? "allowed" : "denied"
      }
    >
      {children}
    </PlatinumAppShell>
  );
}
