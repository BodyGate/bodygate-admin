import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeRfidCode } from "../../../utils/rfid";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function normalizeText(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

async function findBadgeConflict(customerId: string, rawCode: string, controllerCode: string) {
  const { data: customers, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id, first_name, last_name, badge_code, controller_code, is_active, active, status")
    .neq("id", customerId)
    .or(`badge_code.eq.${rawCode},badge_code.eq.${controllerCode},controller_code.eq.${rawCode},controller_code.eq.${controllerCode}`)
    .or("is_active.eq.true,active.eq.true,status.eq.active,status.eq.onboarding");

  if (customerError) throw new Error(`Errore controllo duplicati clienti: ${customerError.message}`);

  if (customers?.length) {
    const owner = customers[0];
    const name = `${owner.first_name || ""} ${owner.last_name || ""}`.trim() || owner.id;
    return `Badge già assegnato a cliente attivo: ${name}.`;
  }

  const { data: credentials, error: credentialsError } = await supabaseAdmin
    .from("access_credentials")
    .select("id, customer_id, code, controller_code, status, is_active")
    .neq("customer_id", customerId)
    .or(`code.eq.${rawCode},code.eq.${controllerCode},controller_code.eq.${rawCode},controller_code.eq.${controllerCode}`);

  if (credentialsError) throw new Error(`Errore controllo duplicati credenziali clienti: ${credentialsError.message}`);

  const activeCredential = (credentials || []).find((row: any) => row.is_active === true || String(row.status || "").toLowerCase() === "active");
  if (activeCredential) return "Badge già assegnato a una credenziale cliente attiva.";

  const { data: customerBadges, error: customerBadgesError } = await supabaseAdmin
    .from("customer_badges")
    .select("id, customer_id, badge_code, is_active")
    .neq("customer_id", customerId)
    .or(`badge_code.eq.${rawCode},badge_code.eq.${controllerCode}`);

  if (customerBadgesError) throw new Error(`Errore controllo duplicati badge clienti: ${customerBadgesError.message}`);

  const activeCustomerBadge = (customerBadges || []).find((row: any) => row.is_active !== false);
  if (activeCustomerBadge) return "Badge già assegnato a un badge cliente attivo.";

  const { data: staff, error: staffError } = await supabaseAdmin
    .from("staff_access_credentials")
    .select("id, staff_user_id, code, controller_code, status, is_active")
    .or(`code.eq.${rawCode},code.eq.${controllerCode},controller_code.eq.${rawCode},controller_code.eq.${controllerCode}`)
    .limit(1);

  if (staffError) throw new Error(`Errore controllo duplicati staff: ${staffError.message}`);

  const activeStaff = (staff || []).find((row: any) => row.is_active === true || String(row.status || "").toLowerCase() === "active");
  if (activeStaff) return "Badge già assegnato a staff attivo.";

  return null;
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

    const badgeInput = normalizeText(profile.badge_code);
    const normalizedBadge = normalizeRfidCode(badgeInput);

    if (badgeInput && !normalizedBadge) {
      return NextResponse.json(
        { ok: false, error: "Codice badge RFID non valido." },
        { status: 400 }
      );
    }

    if (normalizedBadge) {
      const conflict = await findBadgeConflict(
        customerId,
        normalizedBadge.rawCode,
        normalizedBadge.controllerCode
      );

      if (conflict) {
        return NextResponse.json({ ok: false, error: conflict }, { status: 409 });
      }
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
      badge_code: normalizedBadge?.rawCode || null,
      controller_code: normalizedBadge?.controllerCode || null,
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

    if (normalizedBadge) {
      await supabaseAdmin
        .from("access_credentials")
        .upsert(
          {
            customer_id: customerId,
            type: "card",
            code: normalizedBadge.rawCode,
            controller_code: normalizedBadge.controllerCode,
            status: "active",
          },
          { onConflict: "code" }
        );

      await supabaseAdmin
        .from("customer_badges")
        .upsert(
          {
            customer_id: customerId,
            badge_code: normalizedBadge.rawCode,
            is_active: true,
          },
          { onConflict: "badge_code" }
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
