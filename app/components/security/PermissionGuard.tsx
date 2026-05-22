"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentPermissions } from "../../hooks/useCurrentPermissions";

export default function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { loading, hasPermission } = useCurrentPermissions();

  useEffect(() => {
    if (!loading && !hasPermission(permission)) {
      router.push("/access-denied");
    }
  }, [loading, permission, hasPermission, router]);

  if (loading) {
    return (
      <main style={{ padding: 28, color: "white" }}>
        Verifica permessi...
      </main>
    );
  }

  if (!hasPermission(permission)) {
    return null;
  }

  return <>{children}</>;
}