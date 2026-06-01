import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase env mancante");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: roles, error: rolesError } = await supabase
      .from("staff_roles")
      .select("id, role_key, role_name")
      .eq("is_system", true)
      .order("role_name", { ascending: true });

    if (rolesError) {
      throw rolesError;
    }

    const { data: staffRows, error: staffError } = await supabase
      .from("staff_users")
      .select(
        `
        id,
        full_name,
        email,
        role_id,
        is_active,
        created_at,
        staff_roles (
          role_key,
          role_name
        )
      `
      )
      .order("created_at", { ascending: false });

    if (staffError) {
      throw staffError;
    }

    const staff = (staffRows || []).map((row: any) => ({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      role_id: row.role_id,
      is_active: row.is_active,
      created_at: row.created_at,
      role_key: row.staff_roles?.role_key || null,
      role_name: row.staff_roles?.role_name || null,
    }));

    return NextResponse.json({
      ok: true,
      roles: roles || [],
      staff,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore caricamento staff",
      },
      { status: 500 }
    );
  }
}