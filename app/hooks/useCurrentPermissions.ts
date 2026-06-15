"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";


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

    if (!staffUser || !staffUser.staff_roles) {
      setPermissions([]);
      setRoleKey(appUser.role || null);
      setStaffName(appUser.email);
      setLoading(false);
      return;
    }

    const role: any = Array.isArray(staffUser.staff_roles)
      ? staffUser.staff_roles[0]
      : staffUser.staff_roles;

    setRoleKey(role.role_key);
    setStaffName(staffUser.full_name);

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
    setLoading(false);
  }

  useEffect(() => {
    loadPermissions();

    const channelName = `current-permissions-live-${crypto.randomUUID()}`;

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const normalizedRoleKey = roleKey?.toLowerCase().trim() || null;
  const isAdmin = normalizedRoleKey
    ? ["admin", "administrator", "amministratore", "amministrazione", "owner"].includes(normalizedRoleKey)
    : false;

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
