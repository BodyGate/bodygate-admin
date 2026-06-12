import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function normalizeText(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Configurazione Supabase mancante: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const customerId = normalizeText(body.customer_id);
    const profile =
      body.profile && typeof body.profile === "object" ? body.profile : {};

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id obbligatorio" },
        { status: 400 }
      );
    }

    const firstName = normalizeText(profile.first_name);
    const lastName = normalizeText(profile.last_name);

    if (!firstName || !lastName) {
      return NextResponse.json(
        { ok: false, error: "Nome e cognome sono obbligatori." },
        { status: 400 }
      );
    }

    const isActive = profile.is_active !== false;
    const payload = {
      first_name: firstName,
      last_name: lastName,
      phone: normalizeText(profile.phone),
      email: normalizeText(profile.email),
      fiscal_code: normalizeText(profile.fiscal_code),
      birth_date: profile.birth_date || null,
      gender: normalizeText(profile.gender),
      address: normalizeText(profile.address),
      city: normalizeText(profile.city),
      postal_code: normalizeText(profile.postal_code ?? profile.zip),
      emergency_contact_name: normalizeText(profile.emergency_contact_name),
      emergency_contact_phone: normalizeText(profile.emergency_contact_phone),
      reception_notes: normalizeText(profile.reception_notes),
      badge_code: normalizeText(profile.badge_code),
      controller_code: normalizeText(profile.controller_code),
      is_active: isActive,
      active: isActive,
    };

    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .update(payload)
      .eq("id", customerId)
      .select("*")
      .single();

    if (error || !customer) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore aggiornamento profilo cliente",
          detail: error,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("customer_timeline").insert({
      customer_id: customerId,
      type: "customer",
      title: "Anagrafica aggiornata",
      description: "Profilo cliente aggiornato da scheda cliente.",
    });

    return NextResponse.json({
      ok: true,
      customer,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore sconosciuto",
      },
      { status: 500 }
    );
  }
}
