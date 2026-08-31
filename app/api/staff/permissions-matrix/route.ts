import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const [rolesRes, permissionsRes, rolePermissionsRes] = await Promise.all([
      supabase.from("staff_roles").select("*").order("role_name"),
      supabase.from("staff_permissions").select("*").order("category"),
      supabase.from("staff_role_permissions").select("*"),
    ]);

    if (rolesRes.error) throw new Error(rolesRes.error.message);
    if (permissionsRes.error) throw new Error(permissionsRes.error.message);
    if (rolePermissionsRes.error) throw new Error(rolePermissionsRes.error.message);

    return NextResponse.json({
      ok: true,
      roles: rolesRes.data || [],
      permissions: permissionsRes.data || [],
      rolePermissions: rolePermissionsRes.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento permessi.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json().catch(() => ({}));
    const roleId = String(body.role_id || "").trim();
    const permissionId = String(body.permission_id || "").trim();

    if (!roleId || !permissionId) {
      return NextResponse.json(
        { ok: false, error: "role_id e permission_id sono obbligatori." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("staff_role_permissions")
      .select("role_id, permission_id")
      .eq("role_id", roleId)
      .eq("permission_id", permissionId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { error: deleteError } = await supabase
        .from("staff_role_permissions")
        .delete()
        .match({ role_id: roleId, permission_id: permissionId });

      if (deleteError) throw new Error(deleteError.message);

      return NextResponse.json({ ok: true, active: false });
    }

    const { error: insertError } = await supabase
      .from("staff_role_permissions")
      .insert({ role_id: roleId, permission_id: permissionId });

    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({ ok: true, active: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore aggiornamento permesso.",
      },
      { status: 500 }
    );
  }
}
