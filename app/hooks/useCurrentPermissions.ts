"use client";

import { useEffect, useState } from "react";
import { safeRandomId } from "../lib/safeRandomId";
import { supabase } from "../lib/supabaseClient";

const ADMIN_ROLE_KEYS = new Set([
  "admin",
  "administrator",
  "owner",
  "proprietario",
  "super_admin",
  "amministrazione",
  "amministratore",
]);

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
  const [loading, setLoading] = useState(true);

  function readCookie(name: string) {
    if (typeof document === "undefined") return null;
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
  }

  async function loadPermissions() {
    setLoading(true);

    try {
      const sessionUserId = readCookie("bodygate_session");

      if (!sessionUserId) {
        setPermissions([]);
        setRoleKey(null);
        setStaffName(null);
        setLoading(false);
        return;
      }

      const { data: appUser } = await supabase
        .from("app_users")
        .select("id, email, role, active")
        .eq("id", sessionUserId)
        .eq("active", true)
        .maybeSingle();

      if (!appUser?.email) {
        setPermissions([]);
        setRoleKey(null);
        setStaffName(null);
        setLoading(false);
        return;
      }

      const { data: staffUser } = await supabase
        .from("staff_users")
        .select(`
        id,
        full_name,
        email,
        is_active,
        staff_roles (
          id,
          role_key,
          role_name
        )
      `)
        .eq("email", appUser.email)
        .eq("is_active", true)
        .maybeSingle();

      const appRoleKey = appUser.role || null;

      if (isAdminRole(appRoleKey)) {
        setPermissions([]);
        setRoleKey(appRoleKey);
        setStaffName(staffUser?.full_name || appUser.email);
        setLoading(false);
        return;
      }

      if (!staffUser || !staffUser.staff_roles) {
        setPermissions([]);
        setRoleKey(appRoleKey);
        setStaffName(appUser.email);
        setLoading(false);
        return;
      }

      const role: any = Array.isArray(staffUser.staff_roles)
        ? staffUser.staff_roles[0]
        : staffUser.staff_roles;
      const resolvedRoleKey = role?.role_key || appRoleKey;

      if (!role?.id) {
        setPermissions([]);
        setRoleKey(resolvedRoleKey);
        setStaffName(staffUser.full_name || appUser.email);
        setLoading(false);
        return;
      }

      setRoleKey(resolvedRoleKey);
      setStaffName(staffUser.full_name || appUser.email);

      const { data: rolePermissions } = await supabase
        .from("staff_role_permissions")
        .select(`
        staff_permissions (
          permission_key
        )
      `)
        .eq("role_id", role.id);

      const keys =
        rolePermissions
          ?.map((item: any) => {
            const permission = Array.isArray(item.staff_permissions)
              ? item.staff_permissions[0]
              : item.staff_permissions;

            return permission?.permission_key;
          })
          .filter(Boolean) || [];

      setPermissions(keys);
    } catch (error) {
      console.error("Errore caricamento permessi:", error);
      setPermissions([]);
      setRoleKey(null);
      setStaffName(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPermissions();

    const channelName = safeRandomId("current-permissions-live");

    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "staff_role_permissions",
          },
          loadPermissions
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "staff_users",
          },
          loadPermissions
        )
        .subscribe();
    } catch (error) {
      console.error("Errore setup realtime permessi:", error);
      setLoading(false);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const isAdmin = isAdminRole(roleKey);

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
