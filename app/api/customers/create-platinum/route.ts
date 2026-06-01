import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fallbackReceiptNumber() {
  const now = new Date();
  return `${now.getFullYear()}/${Date.now()}`;
}

async function getNextReceiptNumber() {
  const { data, error } = await supabase.rpc("next_bodygate_receipt_number");
  if (error || !data) return fallbackReceiptNumber();
  return String(data);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const fiscalCode = String(body.fiscal_code || "").trim().toUpperCase();

    const rawPlanId = String(body.subscription_plan_id || "").trim();
    const subscriptionPlanId = UUID_RE.test(rawPlanId) ? rawPlanId : null;

    const subscriptionAmount = Number(body.subscription_amount || 0);
    const subscriptionDurationDays = Number(body.subscription_duration_days || 0);
    const subscriptionName = String(body.subscription_name || "Abbonamento").trim();

    const membershipAmount = Number(body.membership_amount || 10);
    const paymentMethod = String(body.payment_method || "cash").trim();

    const badgeCode = String(body.badge_code || "").trim();
    const controllerCode = String(body.controller_code || "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json({ ok: false, error: "Nome e cognome obbligatori." }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ ok: false, error: "Telefono obbligatorio." }, { status: 400 });
    }

    if (!fiscalCode) {
      return NextResponse.json({ ok: false, error: "Codice fiscale obbligatorio." }, { status: 400 });
    }

    if (!membershipAmount || membershipAmount <= 0) {
      return NextResponse.json({ ok: false, error: "Quota associativa obbligatoria non valida." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const today = new Date();
    const todayDate = dateOnly(today);
    const membershipUntil = dateOnly(addDays(today, 365));
    const totalAmount = membershipAmount + Math.max(subscriptionAmount, 0);

    if (totalAmount <= 0) {
      return NextResponse.json({ ok: false, error: "Incasso obbligatorio mancante." }, { status: 400 });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone,
        email: email || null,
        fiscal_code: fiscalCode,

        gender: body.gender || null,
        birth_date: body.birth_date || null,
        birth_place: body.birth_place || null,

        address: body.address || null,
        street_number: body.street_number || null,
        postal_code: body.postal_code || null,
        city: body.city || null,
        province: body.province || null,
        country: body.country || "Italia",

        document_type: body.document_type || null,
        document_number: body.document_number || null,
        document_issued_by: body.document_issued_by || null,
        document_issued_at: body.document_issued_at || null,
        document_expires_at: body.document_expires_at || null,

        emergency_contact_name: body.emergency_contact_name || null,
        emergency_contact_phone: body.emergency_contact_phone || null,
        emergency_contact_relation: body.emergency_contact_relation || null,

        profession: body.profession || null,
        fitness_goal: body.fitness_goal || null,
        marketing_source: body.marketing_source || null,
        customer_tags: Array.isArray(body.customer_tags) ? body.customer_tags : [],

        badge_code: badgeCode || null,
        controller_code: controllerCode || null,

        medical_certificate_start_date: body.medical_certificate_start_date || null,
        medical_certificate_end_date: body.medical_certificate_end_date || null,
        medical_certificate_url: body.medical_certificate_url || null,
        medical_certificate_status: body.medical_certificate_end_date ? "valid" : "missing",

        active: false,
        is_active: false,
        status: "onboarding",

        subscription_status: subscriptionAmount > 0 ? "active" : "pending",
        subscription_expiry: null,

        onboarding_status: "contract_pending",
        payment_status: "paid",
        contract_status: "pending_signature",
        access_activation_status: "pending",

        privacy_consent: Boolean(body.privacy_consent),
        marketing_consent: Boolean(body.marketing_consent),
        photo_video_consent: Boolean(body.photo_video_consent),
      })
      .select("id, branch_id")
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { ok: false, error: customerError?.message || "Errore creazione cliente." },
        { status: 500 }
      );
    }

    const customerId = customer.id;
    const branchId = customer.branch_id || null;

    const { error: membershipError } = await supabase.from("customer_membership_fees").insert({
      customer_id: customerId,
      branch_id: branchId,
      amount: membershipAmount,
      paid_at: now,
      valid_from: todayDate,
      valid_until: membershipUntil,
      payment_method: paymentMethod,
      notes: "Quota associativa creata da onboarding Platinum",
    });

    if (membershipError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cliente creato ma quota associativa non registrata: ${membershipError.message}`,
          customer_id: customerId,
        },
        { status: 500 }
      );
    }

    let subscriptionId: string | null = null;
    let subscriptionEndsAt: string | null = null;

    if (subscriptionAmount > 0 && subscriptionDurationDays > 0) {
      subscriptionEndsAt = dateOnly(addDays(today, subscriptionDurationDays));

      const { data: subscription, error: subscriptionError } = await supabase
        .from("customer_subscriptions")
        .insert({
          customer_id: customerId,
          branch_id: branchId,
          plan_id: subscriptionPlanId,
          amount: subscriptionAmount,
          starts_at: todayDate,
          ends_at: subscriptionEndsAt,
          is_active: true,
          payment_method: paymentMethod,
          notes: `Creato da onboarding Platinum: ${subscriptionName}`,
        })
        .select("id")
        .single();

      if (subscriptionError) {
        return NextResponse.json(
          {
            ok: false,
            error: `Cliente creato ma abbonamento non registrato: ${subscriptionError.message}`,
            customer_id: customerId,
          },
          { status: 500 }
        );
      }

      subscriptionId = subscription?.id || null;

      await supabase
        .from("customers")
        .update({
          subscription_status: "active",
          subscription_expiry: subscriptionEndsAt,
        })
        .eq("id", customerId);
    } else {
      await supabase
        .from("customers")
        .update({
          subscription_status: "pending",
          subscription_expiry: null,
        })
        .eq("id", customerId);
    }

    const description =
      subscriptionAmount > 0
        ? `Onboarding cliente: quota associativa + ${subscriptionName}`
        : "Onboarding cliente: quota associativa";

    const { data: payment, error: paymentError } = await supabase
      .from("customer_payments")
      .insert({
        customer_id: customerId,
        type: "onboarding",
        description,
        amount: totalAmount,
        payment_method: paymentMethod,
        status: "paid",
        paid_at: now,
        notes: "Incasso obbligatorio nuovo cliente",
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        {
          ok: false,
          error: paymentError?.message || "Cliente creato ma pagamento non registrato.",
          customer_id: customerId,
        },
        { status: 500 }
      );
    }

    await supabase.from("payments").insert({
      customer_id: customerId,
      payment_method_id: null,
      amount: totalAmount,
      payment_type: "onboarding",
      description,
      status: "paid",
      paid_at: now,
      created_by: "admin@bodygate.it",
    });

    await supabase.from("accounting_entries").insert({
      branch_id: branchId,
      customer_id: customerId,
      direction: "income",
      category: "onboarding",
      description,
      amount: totalAmount,
      payment_method: paymentMethod,
      entry_date: todayDate,
      source: "customer_onboarding",
      source_id: payment.id,
      operator_name: "BodyGate",
    });

    const receiptNumber = await getNextReceiptNumber();

    await supabase.from("customer_receipts").insert({
      customer_id: customerId,
      payment_id: payment.id,
      subscription_id: subscriptionId,
      receipt_number: receiptNumber,
      receipt_type: "onboarding",
      amount: totalAmount,
      description,
      customer_copy_label: "COPIA CLIENTE",
      gym_copy_label: "COPIA PALESTRA",
      issued_at: now,
    });

    if (badgeCode || controllerCode) {
      const { error: credentialError } = await supabase
        .from("access_credentials")
        .upsert(
          {
            customer_id: customerId,
            type: "card",
            code: badgeCode || controllerCode,
            controller_code: controllerCode || null,
            status: "active",
          },
          { onConflict: "code" }
        );

      if (credentialError) {
        return NextResponse.json(
          {
            ok: false,
            error: `Cliente creato ma credenziale non registrata: ${credentialError.message}`,
            customer_id: customerId,
          },
          { status: 500 }
        );
      }

      await supabase
        .from("customers")
        .update({
          access_activation_status: "badge_assigned",
        })
        .eq("id", customerId);
    }

    if (body.medical_certificate_start_date || body.medical_certificate_end_date || body.medical_certificate_url) {
      await supabase.from("medical_certificates").insert({
        customer_id: customerId,
        valid_from: body.medical_certificate_start_date || null,
        valid_until: body.medical_certificate_end_date || null,
        expiry_date: body.medical_certificate_end_date || null,
        status: body.medical_certificate_end_date ? "valid" : "missing",
        certificate_type: "non_agonistico",
      });
    }

    await supabase.from("customer_timeline").insert([
      {
        customer_id: customerId,
        type: "customer",
        title: "Cliente creato",
        description: `${firstName} ${lastName} creato tramite onboarding Platinum`,
        created_at: now,
      },
      {
        customer_id: customerId,
        type: "payment",
        title: "Incasso onboarding registrato",
        description: `${description} - €${totalAmount.toFixed(2)}`,
        created_at: now,
      },
      {
        customer_id: customerId,
        type: "contract",
        title: "Contratto in attesa di firma",
        description: "Il cliente deve completare la firma OTP del contratto.",
        created_at: now,
      },
    ]);

    return NextResponse.json({
      ok: true,
      customer_id: customerId,
      payment_id: payment.id,
      subscription_id: subscriptionId,
      receipt_number: receiptNumber,
      next_url: `/customers/${customerId}/contract`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Errore onboarding Platinum." },
      { status: 500 }
    );
  }
}