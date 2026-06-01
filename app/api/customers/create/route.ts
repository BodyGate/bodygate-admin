import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isMissingTableError(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("does not exist") ||
    lower.includes("42p01") ||
    lower.includes("relation")
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const taxCode = String(body.tax_code || "").trim().toUpperCase();
    const badgeCode = String(body.badge_code || "").trim();
    const controllerCode = String(body.controller_code || "").trim();

    const medicalValidFrom = String(body.medical_valid_from || "").trim();
    const medicalValidUntil = String(body.medical_valid_until || "").trim();

    const membershipValidUntil = String(body.membership_valid_until || "").trim();

    const subscriptionStartsAt = String(body.subscription_starts_at || "").trim();
    const subscriptionEndsAt = String(body.subscription_ends_at || "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json(
        { ok: false, error: "Nome e cognome sono obbligatori." },
        { status: 400 }
      );
    }

    if (!badgeCode && !controllerCode) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Inserisci almeno badge code o controller code per creare la credenziale di accesso.",
        },
        { status: 400 }
      );
    }

    if (medicalValidFrom && medicalValidUntil && medicalValidUntil < medicalValidFrom) {
      return NextResponse.json(
        {
          ok: false,
          error: "La data fine certificato non può essere precedente alla data inizio.",
        },
        { status: 400 }
      );
    }

    if (
      subscriptionStartsAt &&
      subscriptionEndsAt &&
      subscriptionEndsAt < subscriptionStartsAt
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "La data fine abbonamento non può essere precedente alla data inizio.",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const warnings: string[] = [];

    const customerPayload: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
      phone: phone || null,
      email: email || null,
      tax_code: taxCode || null,
      active: true,
    };

    if (medicalValidUntil) {
      customerPayload.medical_certificate_end_date = medicalValidUntil;
      customerPayload.medical_certificate_end = medicalValidUntil;
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert(customerPayload)
      .select("id")
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        {
          ok: false,
          error: `Errore creazione cliente: ${
            customerError?.message || "cliente non creato"
          }`,
        },
        { status: 500 }
      );
    }

    const customerId = customer.id as string;

    const { error: credentialError } = await supabase
      .from("access_credentials")
      .insert({
        customer_id: customerId,
        code: badgeCode || controllerCode,
        controller_code: controllerCode || null,
        status: "active",
      });

    if (credentialError) {
      if (isMissingTableError(credentialError.message)) {
        warnings.push(
          "Tabella access_credentials non trovata: credenziale accesso non salvata."
        );
      } else {
        return NextResponse.json(
          {
            ok: false,
            error: `Cliente creato ma credenziale accesso non salvata: ${credentialError.message}`,
            customer_id: customerId,
          },
          { status: 500 }
        );
      }
    }

    if (medicalValidFrom && medicalValidUntil) {
      const { error: certError } = await supabase.from("medical_certificates").insert({
        customer_id: customerId,
        valid_from: medicalValidFrom,
        valid_until: medicalValidUntil,
        expiry_date: medicalValidUntil,
        status: "valid",
        certificate_type: "non_agonistico",
      });

      if (certError) {
        if (isMissingTableError(certError.message)) {
          warnings.push(
            "Tabella medical_certificates non trovata: certificato salvato solo su customers."
          );
        } else {
          warnings.push(`Certificato non inserito: ${certError.message}`);
        }
      }
    }

    if (membershipValidUntil) {
      const { error: membershipError } = await supabase
        .from("customer_membership_fees")
        .insert({
          customer_id: customerId,
          valid_from: today,
          valid_until: membershipValidUntil,
          amount: 10,
          payment_method: "cash",
        });

      if (membershipError) {
        warnings.push(`Quota associativa non inserita: ${membershipError.message}`);
      } else {
        await supabase.from("customer_timeline").insert({
          customer_id: customerId,
          type: "membership",
          title: "Quota associativa inserita da Reception",
          description: `Quota associativa valida fino al ${membershipValidUntil}`,
          created_at: now,
        });
      }
    }

    if (subscriptionStartsAt && subscriptionEndsAt) {
      const { error: subscriptionError } = await supabase
        .from("customer_subscriptions")
        .insert({
          customer_id: customerId,
          is_active: true,
          starts_at: subscriptionStartsAt,
          ends_at: subscriptionEndsAt,
        });

      if (subscriptionError) {
        warnings.push(`Abbonamento non inserito: ${subscriptionError.message}`);
      } else {
        await supabase.from("customer_timeline").insert({
          customer_id: customerId,
          type: "subscription",
          title: "Abbonamento inserito da Reception",
          description: `Abbonamento valido dal ${subscriptionStartsAt} al ${subscriptionEndsAt}`,
          created_at: now,
        });
      }
    }

    await supabase.from("customer_timeline").insert({
      customer_id: customerId,
      type: "customer",
      title: "Cliente creato da Reception",
      description: `Nuovo cliente rapido: ${firstName} ${lastName}`,
      created_at: now,
    });

    return NextResponse.json({
      ok: true,
      customer_id: customerId,
      warnings,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore imprevisto creazione cliente.",
      },
      { status: 500 }
    );
  }
}