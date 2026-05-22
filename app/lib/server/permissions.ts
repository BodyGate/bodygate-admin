import { NextResponse } from "next/server";
import { supabase } from "../supabaseClient";

const CURRENT_STAFF_EMAIL = "admin@bodygate.it";

export async function requirePermission(permissionKey: string) {
  const { data: staffUser } = await supabase
    .from("staff_users")
    .select(`
      id,
      email,
      is_active,
      staff_roles (
        id,
        role_key
      )
    `)
    .eq("email", CURRENT_STAFF_EMAIL)
    .eq("is_active", true)
    .maybeSingle();

  if (!staffUser || !staffUser.staff_roles) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Utente staff non autorizzato",
        },
        { status: 403 }
      ),
    };
  }

  const role: any = staffUser.staff_roles;

  const { data: rolePermission } = await supabase
    .from("staff_role_permissions")
    .select(`
      id,
      staff_permissions (
        permission_key
      )
    `)
    .eq("role_id", role.id)
    .eq("staff_permissions.permission_key", permissionKey)
    .maybeSingle();

  if (!rolePermission) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Permesso insufficiente",
          required_permission: permissionKey,
        },
        { status: 403 }
      ),
    };
  }

  return {
    allowed: true,
    response: null,
  };
}