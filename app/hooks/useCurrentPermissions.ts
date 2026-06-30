"use client";

import { useCallback, useEffect, useState } from "react";

const ADMIN_ROLE_KEYS = new Set([
  "admin",
  "administrator",
  "owner",
  "proprietario",
  "super_admin",
  "amministrazione",
  "amministratore",
]);

type CurrentAuthResponse = {
  ok: boolean;
  role_key?: string | null;
  staff_name?: string | null;
  permissions?: string[];
  is_admin?: boolean;
};

function normalizeRoleKey(roleKey?: string | null) {
  return roleKey?.toLowerCase().trim() || null;
}

export function isAdminRole(roleKey?: string | null) {
  const normalized = normalizeRoleKey(roleKey);
  return normalized ? ADMIN_ROLE_KEYS.has(normalized) : false;
}

export function useCurrentPermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleKey, setRoleKey] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [serverIsAdmin, setServerIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const resetPermissions = useCallback(() => {
    setPermissions([]);
    setRoleKey(null);
    setStaffName(null);
    setServerIsAdmin(false);
  }, []);

  const loadPermissions = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          resetPermissions();

          if (
            response.status === 401 &&
            typeof window !== "undefined" &&
            window.location.pathname !== "/login"
          ) {
            window.location.assign("/login");
          }

          return;
        }

        const result = (await response.json()) as CurrentAuthResponse;

        if (!result.ok) {
          resetPermissions();
          return;
        }

        setPermissions(
          Array.isArray(result.permissions) ? result.permissions : []
        );
        setRoleKey(result.role_key || null);
        setStaffName(result.staff_name || null);
        setServerIsAdmin(Boolean(result.is_admin));
      } catch (error) {
        console.error("Errore caricamento permessi:", error);
        resetPermissions();
      } finally {
        setLoading(false);
      }
    },
    [resetPermissions]
  );

  useEffect(() => {
    void loadPermissions(true);

    const handleFocus = () => {
      void loadPermissions();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadPermissions();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [loadPermissions]);

  const isAdmin = serverIsAdmin || isAdminRole(roleKey);

  function hasPermission(permissionKey: string) {
    if (isAdmin) return true;

    return permissions.includes(permissionKey);
  }

  return {
    permissions,
    roleKey,
    staffName,
    loading,
    hasPermission,
    isAdmin,
  };
}