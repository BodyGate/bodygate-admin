import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const allowedFields = [
  "first_name",
  "last_name",
  "phone",
  "email",
  "fiscal_code",
  "birth_date",
  "gender",
  "address",
  "city",
  "postal_code",
  "emergency_contact_name",
  "emergency_contact_phone",
  "reception_notes",
  "badge_code",
  "controller_code",
  "is_active",
];

function cleanValue(value: any) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  return value;
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Variabili Supabase mancanti. Controlla NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const customerId = String(body.customer_id || "").trim();
    const profile = body.profile || {};

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "customer_id mancante" },
        { status: 400 }
      );
    }

    const firstName = String(profile.first_name || "").trim();
    const lastName = String(profile.last_name || "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json(
        { ok: false, error: "Nome e cognome sono obbligatori" },
        { status: 400 }
      );
    }

    const payload: Record<string, any> = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(profile, field)) {
        payload[field] = cleanValue(profile[field]);
      }
    }

    payload.first_name = firstName;
    payload.last_name = lastName;
    payload.is_active = profile.is_active !== false;

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .update(payload)
      .eq("id", customerId)
      .select("*")
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        {
          ok: false,
          error: "Errore aggiornamento anagrafica cliente",
          detail: customerError,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("customer_timeline").insert({
      customer_id: customerId,
      type: "customer",
      title: "Anagrafica cliente aggiornata",
      description: "Dati anagrafici modificati dalla scheda cliente",
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
