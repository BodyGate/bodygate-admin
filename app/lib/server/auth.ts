import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "../auth/session";

const ADMIN_ROLE_KEYS = new Set([
  "admin",
  "administrator",
  "owner",
  "proprietario",
  "super_admin",
  "amministrazione",
  "amministratore",
]);

type AppUser = {
  id: string;
  email: string;
  role: string;
  active: boolean;
};

export type CurrentAuthContext = {
  user: AppUser;
  roleKey: string | null;
  staffName: string;
  permissions: string[];
  isAdmin: boolean;
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function normalizeRoleKey(roleKey?: string | null) {
  return roleKey?.toLowerCase().trim() || null;
}

function isAdminRole(roleKey?: string | null) {
  const normalized = normalizeRoleKey(roleKey);
  return normalized ? ADMIN_ROLE_KEYS.has(normalized) : false;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configurazione Supabase server mancante.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireSession(): Promise<AppUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const claims = await verifySessionToken(token);

  if (!claims) {
    throw new UnauthorizedError();
  }

  const supabase = getSupabaseAdmin();
  const { data: user, error } = await supabase
    .from("app_users")
    .select("id, email, role, active")
    .eq("id", claims.userId)
    .eq("active", true)
    .maybeSingle();

  if (error || !user) {
    throw new UnauthorizedError();
  }

  return user as AppUser;
}

export async function getCurrentAuthContext(): Promise<CurrentAuthContext> {
  const user = await requireSession();
  const supabase = getSupabaseAdmin();

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
    .eq("email", user.email)
    .eq("is_active", true)
    .maybeSingle();

  const staffUserRecord = staffUser as any;
  const role = Array.isArray(staffUserRecord?.staff_roles)
    ? staffUserRecord.staff_roles[0]
    : staffUserRecord?.staff_roles;
  const roleKey = role?.role_key || user.role || null;
  const staffName = staffUserRecord?.full_name || user.email;
  const isAdmin = isAdminRole(roleKey) || isAdminRole(user.role);

  if (isAdmin || !role?.id) {
    return {
      user,
      roleKey,
      staffName,
      permissions: [],
      isAdmin,
    };
  }

  const { data: rolePermissions, error: permissionsError } = await supabase
    .from("staff_role_permissions")
    .select(`
      staff_permissions (
        permission_key
      )
    `)
    .eq("role_id", role.id);

  if (permissionsError) {
    throw new Error("Impossibile caricare i permessi del ruolo.");
  }

  const permissions =
    rolePermissions
      ?.map((item: any) => {
        const permission = Array.isArray(item.staff_permissions)
          ? item.staff_permissions[0]
          : item.staff_permissions;

        return permission?.permission_key;
      })
      .filter((permissionKey): permissionKey is string =>
        Boolean(permissionKey)
      ) || [];

  return {
    user,
    roleKey,
    staffName,
    permissions,
    isAdmin,
  };
}
