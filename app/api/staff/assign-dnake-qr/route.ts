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

function normalizeDnakeQrCode(value: unknown) {
  return String(value || "").trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const staffUserId = String(
      body.staff_user_id || body.staffUserId || ""
    ).trim();

    const dnakeQrCode = normalizeDnakeQrCode(
      body.dnake_qr_code || body.dnakeQrCode || body.code
    );

    if (!staffUserId) {
      return NextResponse.json(
        { ok: false, error: "staff_user_id mancante" },
        { status: 400 }
      );
    }

    if (!dnakeQrCode) {
      return NextResponse.json(
        { ok: false, error: "Codice QR DNake mancante" },
        { status: 400 }
      );
    }

    if (!dnakeQrCode.startsWith("local_user=")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Formato QR DNake non valido. Il codice deve iniziare con local_user=",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: staffUser, error: staffError } = await supabase
      .from("staff_users")
      .select("id, full_name, is_active")
      .eq("id", staffUserId)
      .maybeSingle();

    if (staffError) throw staffError;

    if (!staffUser) {
      return NextResponse.json(
        { ok: false, error: "Utente staff non trovato" },
        { status: 404 }
      );
    }

    const { data: duplicateCustomerCredential } = await supabase
      .from("access_credentials")
      .select("id, customer_id")
      .eq("code", dnakeQrCode)
      .eq("status", "active")
      .maybeSingle();

    if (duplicateCustomerCredential) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Questo QR DNake è già associato a un cliente attivo. Non può essere assegnato allo staff.",
        },
        { status: 409 }
      );
    }

    const { data: duplicateStaffCredential } = await supabase
      .from("staff_access_credentials")
      .select("id, staff_user_id")
      .eq("code", dnakeQrCode)
      .eq("status", "active")
      .maybeSingle();

    if (
      duplicateStaffCredential &&
      duplicateStaffCredential.staff_user_id !== staffUserId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Questo QR DNake è già associato a un altro utente staff attivo.",
        },
        { status: 409 }
      );
    }

    await supabase
      .from("staff_access_credentials")
      .update({
        status: "inactive",
      })
      .eq("staff_user_id", staffUserId)
      .eq("type", "qr")
      .eq("status", "active");

    const { data: credential, error: insertError } = await supabase
      .from("staff_access_credentials")
      .insert({
        staff_user_id: staffUserId,
        type: "qr",
        code: dnakeQrCode,
        status: "active",
      })
      .select("id, staff_user_id, type, code, status")
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      staff_user_id: staffUserId,
      staff_name: staffUser.full_name,
      credential,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore associazione QR DNake staff",
      },
      { status: 500 }
    );
  }
}