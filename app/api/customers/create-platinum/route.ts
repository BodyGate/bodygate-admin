import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { credentialLookupCodes, normalizeRfidCode } from "../../../utils/rfid";
import {
  getDefaultOperationalBranch,
  tableHasColumn,
} from "../../../lib/server/defaultBranch";
import { getDefaultBadgeFee, normalizeBadgeChargeMode } from "../../../lib/server/badgeFee";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PlatinumPlan = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
};

const OFFICIAL_SUBSCRIPTION_PLAN_NAMES = new Set([
  "Mensile",
  "Trimestrale",
  "Semestrale",
  "Annuale",
  "Annuale ridotto Lun Mer Ven",
  "Annuale ridotto Mar Gio Sab",
  "Mensile Ridotto Lunedi-Mercoledi-Venerdi",
  "Mensile Ridotto Martedi-Giovedi-Sabato",
  "Pilates",
]);

function isOfficialPlanName(name: unknown) {
  return OFFICIAL_SUBSCRIPTION_PLAN_NAMES.has(String(name || "").trim());
}

type SubscriptionPlanRow = {
  id: string;
  name: string | null;
  price: number | null;
  promo_price: number | null;
  duration_days: number | null;
};

async function getActiveMembershipFee(branchId: string) {
  const { data, error } = await supabase
    .from("membership_fee_settings")
    .select("name, price, validity_days, is_active")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("membership fee lookup failed", error);
    return null;
  }

  if (!data) return null;

  return {
    name: data.name || "Quota associativa",
    price: Number(data.price || 0),
    validity_days: Number(data.validity_days || 365),
  };
}

async function getActiveSubscriptionPlans(branchId: string): Promise<PlatinumPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("id, name, price, promo_price, duration_days, sort_order, is_active")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("duration_days", { ascending: true });

  if (error) {
    console.warn("subscription plans lookup failed", error);
    return [];
  }

  return ((data || []) as SubscriptionPlanRow[]).filter((plan) => isOfficialPlanName(plan.name)).map((plan) => ({
    id: plan.id,
    name: plan.name || "Abbonamento",
    price: Number(plan.promo_price || plan.price || 0),
    duration_days: Number(plan.duration_days || 0),
  }));
}

async function getPlatinumConfig() {
  const branch = await getDefaultOperationalBranch(supabase);
  if (!branch?.id) return null;

  const [membershipFee, plans] = await Promise.all([
    getActiveMembershipFee(branch.id),
    getActiveSubscriptionPlans(branch.id),
  ]);

  return {
    branch,
    membership_fee: membershipFee || {
      name: "Quota associativa",
      price: 10,
      validity_days: 365,
    },
    plans,
    badge_fee: getDefaultBadgeFee(),
  };
}


function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function findActiveBadgeDuplicate(rawCode: string, controllerCode: string) {
  const lookupCodes = credentialLookupCodes(rawCode || controllerCode);
  const credentialFilter = lookupCodes.map((code) => `code.eq.${code},controller_code.eq.${code}`).join(",");
  const customerFilter = lookupCodes.map((code) => `badge_code.eq.${code},controller_code.eq.${code}`).join(",");
  const badgeFilter = lookupCodes.map((code) => `badge_code.eq.${code}`).join(",");
  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("id, first_name, last_name, badge_code, controller_code, is_active, active, status")
    .or(customerFilter)
    .or("is_active.eq.true,active.eq.true,status.eq.active,status.eq.onboarding");

  if (customersError) throw new Error(`Errore controllo duplicati clienti: ${customersError.message}`);

  if (customers?.length) {
    const owner = customers[0];
    const name = `${owner.first_name || ""} ${owner.last_name || ""}`.trim() || owner.id;
    return `Badge già assegnato a cliente attivo: ${name}.`;
  }

  const { data: credentials, error: credentialsError } = await supabase
    .from("access_credentials")
    .select("id, customer_id, code, controller_code, status, is_active")
    .or(credentialFilter);

  if (credentialsError) throw new Error(`Errore controllo duplicati credenziali clienti: ${credentialsError.message}`);

  const activeCredential = (credentials || []).find((row) => row.is_active === true || String(row.status || "").toLowerCase() === "active");
  if (activeCredential) return "Badge già assegnato a una credenziale cliente attiva.";

  const { data: customerBadges, error: customerBadgesError } = await supabase
    .from("customer_badges")
    .select("id, customer_id, badge_code, is_active")
    .or(badgeFilter);

  if (customerBadgesError) throw new Error(`Errore controllo duplicati badge clienti: ${customerBadgesError.message}`);

  const activeCustomerBadge = (customerBadges || []).find((row) => row.is_active !== false);
  if (activeCustomerBadge) return "Badge già assegnato a un badge cliente attivo.";

  const { data: staff, error: staffError } = await supabase
    .from("staff_access_credentials")
    .select("id, staff_user_id, code, controller_code, status, is_active")
    .or(credentialFilter)
    .limit(1);

  if (staffError) throw new Error(`Errore controllo duplicati staff: ${staffError.message}`);

  const activeStaff = (staff || []).find((row) => row.is_active === true || String(row.status || "").toLowerCase() === "active");
  if (activeStaff) return "Badge già assegnato a staff attivo.";

  return null;
}

type ReceiptNumberPayload = {
  receipt_year: number;
  receipt_sequence: number;
  receipt_number: string;
};

function parseReceiptNumberPayload(data: unknown): ReceiptNumberPayload | null {
  const payload =
    typeof data === "string" ? (JSON.parse(data) as unknown) : data;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const receiptData = payload as Partial<ReceiptNumberPayload>;

  if (
    typeof receiptData.receipt_year !== "number" ||
    typeof receiptData.receipt_sequence !== "number" ||
    typeof receiptData.receipt_number !== "string" ||
    !receiptData.receipt_number
  ) {
    return null;
  }

  return {
    receipt_year: receiptData.receipt_year,
    receipt_sequence: receiptData.receipt_sequence,
    receipt_number: receiptData.receipt_number,
  };
}

async function getNextReceiptNumber(): Promise<ReceiptNumberPayload> {
  const { data, error } = await supabase.rpc("next_bodygate_receipt_number_v2");

  if (error || !data) {
    console.error("next_bodygate_receipt_number_v2 error", error);
    throw new Error(
      "Impossibile generare numero ricevuta progressivo annuale.",
    );
  }

  try {
    const receiptNumber = parseReceiptNumberPayload(data);

    if (!receiptNumber) {
      throw new Error("Payload RPC non valido.");
    }

    return receiptNumber;
  } catch (error) {
    console.error("next_bodygate_receipt_number_v2 payload error", error);
    throw new Error(
      "Impossibile generare numero ricevuta progressivo annuale.",
    );
  }
}

export async function GET() {
  try {
    const config = await getPlatinumConfig();

    if (!config) {
      return NextResponse.json(
        { ok: false, error: "Nessuna sede operativa attiva disponibile per l’onboarding." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, ...config });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Errore configurazione onboarding Platinum." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const fiscalCode = String(body.fiscal_code || "")
      .trim()
      .toUpperCase();

    const subscriptionChoice = String(body.subscription_choice || body.subscription_mode || "with_subscription").trim();
    if (subscriptionChoice !== "membership_only" && subscriptionChoice !== "with_subscription") {
      return NextResponse.json({ ok: false, error: "Scelta abbonamento non valida." }, { status: 400 });
    }
    const rawPlanId = String(body.subscription_plan_id || "").trim();
    const subscriptionPlanId = UUID_RE.test(rawPlanId) ? rawPlanId : null;

    let subscriptionAmount = 0;
    let subscriptionDurationDays = 0;
    let subscriptionName = String(
      body.subscription_name || "Abbonamento",
    ).trim();

    let membershipAmount = Number(body.membership_amount || 10);
    let membershipValidityDays = 365;
    const paymentMethod = String(body.payment_method || "cash").trim();

    const badgeInput = String(body.badge_code || body.controller_code || "").trim();
    const normalizedBadge = normalizeRfidCode(badgeInput);
    const badgeCode = normalizedBadge?.rawCode || "";
    const controllerCode = normalizedBadge?.controllerCode || "";
    const badgeChargeMode = normalizeBadgeChargeMode(body.badge_charge_mode);
    const badgeComplimentaryReason = String(body.badge_complimentary_reason || "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json(
        { ok: false, error: "Nome e cognome obbligatori." },
        { status: 400 },
      );
    }

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Telefono obbligatorio." },
        { status: 400 },
      );
    }

    if (!fiscalCode) {
      return NextResponse.json(
        { ok: false, error: "Codice fiscale obbligatorio." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const today = new Date();
    const todayDate = dateOnly(today);

    if (badgeInput && !normalizedBadge) {
      return NextResponse.json(
        { ok: false, error: "Codice badge RFID non valido." },
        { status: 400 },
      );
    }

    if (normalizedBadge) {
      const duplicateError = await findActiveBadgeDuplicate(
        normalizedBadge.rawCode,
        normalizedBadge.controllerCode,
      );

      if (duplicateError) {
        return NextResponse.json({ ok: false, error: duplicateError }, { status: 409 });
      }
    }

    const defaultBranch = await getDefaultOperationalBranch(supabase);
    const branchId = typeof body.branch_id === "string" && UUID_RE.test(body.branch_id)
      ? body.branch_id
      : defaultBranch?.id || null;

    if (!branchId) {
      return NextResponse.json(
        { ok: false, error: "Nessuna sede operativa attiva disponibile per completare l’onboarding." },
        { status: 500 },
      );
    }

    const [customerPaymentsHasBranch, paymentsHasBranch, receiptsHasBranch, membershipFee, receiptsHasComponents] =
      await Promise.all([
        tableHasColumn(supabase, "customer_payments", "branch_id"),
        tableHasColumn(supabase, "payments", "branch_id"),
        tableHasColumn(supabase, "customer_receipts", "branch_id"),
        getActiveMembershipFee(branchId),
        tableHasColumn(supabase, "customer_receipts", "receipt_components"),
      ]);

    if (membershipFee) {
      membershipAmount = membershipFee.price;
      membershipValidityDays = membershipFee.validity_days || 365;
    }

    if (subscriptionChoice === "with_subscription" && !subscriptionPlanId) {
      return NextResponse.json(
        { ok: false, error: "Seleziona un piano abbonamento valido." },
        { status: 400 },
      );
    }

    if (subscriptionChoice === "with_subscription" && subscriptionPlanId) {
      const { data: selectedPlan, error: selectedPlanError } = await supabase
        .from("subscription_plans")
        .select("id, name, price, promo_price, duration_days, is_active, branch_id")
        .eq("id", subscriptionPlanId)
        .eq("branch_id", branchId)
        .maybeSingle();

      if (selectedPlanError || !selectedPlan || selectedPlan.is_active === false || selectedPlan.branch_id !== branchId || !isOfficialPlanName(selectedPlan.name)) {
        return NextResponse.json(
          { ok: false, error: "Piano abbonamento non valido per la sede selezionata." },
          { status: 400 },
        );
      }

      subscriptionName = selectedPlan.name || subscriptionName;
      subscriptionAmount = Number(selectedPlan.promo_price || selectedPlan.price || 0);
      subscriptionDurationDays = Number(selectedPlan.duration_days || 0);
    }

    if (!membershipAmount || membershipAmount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Quota associativa obbligatoria non valida." },
        { status: 400 },
      );
    }

    const badgeFeeConfig = getDefaultBadgeFee();
    const hasDeliveredBadge = Boolean(badgeCode || controllerCode);

    if (badgeChargeMode === "charged" && !hasDeliveredBadge) {
      return NextResponse.json(
        { ok: false, error: "Per addebitare il Badge RFID serve un codice badge/controller valido." },
        { status: 400 },
      );
    }

    if (badgeChargeMode === "complimentary" && !badgeComplimentaryReason) {
      return NextResponse.json(
        { ok: false, error: "Per omaggiare il Badge RFID è obbligatorio indicare il motivo operatore." },
        { status: 400 },
      );
    }

    const badgeFee = badgeChargeMode === "charged" && badgeFeeConfig.is_active ? badgeFeeConfig.price : 0;
    const membershipUntil = dateOnly(addDays(today, membershipValidityDays));
    const receiptComponents = [
      ...(subscriptionAmount > 0 ? [{ code: "subscription", label: `Abbonamento ${subscriptionName}`, amount: subscriptionAmount }] : []),
      { code: "membership_fee", label: "Quota associativa", amount: membershipAmount },
      ...(badgeChargeMode !== "not_included" ? [{ code: "rfid_badge", label: "Badge RFID", amount: badgeFee }] : []),
    ];
    const componentDescription = receiptComponents.map((component) => `${component.label} €${Number(component.amount).toFixed(2).replace(".", ",")}`).join(" + ");
    const totalAmount = membershipAmount + Math.max(subscriptionAmount, 0) + badgeFee;

    if (totalAmount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Incasso obbligatorio mancante." },
        { status: 400 },
      );
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone,
        email: email || null,
        fiscal_code: fiscalCode,
        branch_id: branchId,

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
        customer_tags: Array.isArray(body.customer_tags)
          ? body.customer_tags
          : [],

        badge_code: badgeCode || null,
        controller_code: controllerCode || null,

        medical_certificate_start_date:
          body.medical_certificate_start_date || null,
        medical_certificate_end_date: body.medical_certificate_end_date || null,
        medical_certificate_url: body.medical_certificate_url || null,
        medical_certificate_status: body.medical_certificate_end_date
          ? "valid"
          : "missing",

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
        {
          ok: false,
          error: customerError?.message || "Errore creazione cliente.",
        },
        { status: 500 },
      );
    }

    const customerId = customer.id;
    const customerBranchId = customer.branch_id || branchId;

    const { error: membershipError } = await supabase
      .from("customer_membership_fees")
      .insert({
        customer_id: customerId,
        branch_id: customerBranchId,
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
        { status: 500 },
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
          branch_id: customerBranchId,
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
          { status: 500 },
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

    const description = `Nuova iscrizione: ${componentDescription}`;

    const { data: payment, error: paymentError } = await supabase
      .from("customer_payments")
      .insert({
        customer_id: customerId,
        ...(customerPaymentsHasBranch ? { branch_id: customerBranchId } : {}),
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
          error:
            paymentError?.message ||
            "Cliente creato ma pagamento non registrato.",
          customer_id: customerId,
        },
        { status: 500 },
      );
    }

    await supabase.from("payments").insert({
      customer_id: customerId,
      ...(paymentsHasBranch ? { branch_id: customerBranchId } : {}),
      payment_method_id: null,
      amount: totalAmount,
      payment_type: "onboarding",
      description,
      status: "paid",
      paid_at: now,
      created_by: "admin@bodygate.it",
    });

    const receiptNumber = await getNextReceiptNumber();

    const { error: receiptError } = await supabase
      .from("customer_receipts")
      .insert({
        customer_id: customerId,
        ...(receiptsHasBranch ? { branch_id: customerBranchId } : {}),
        payment_id: payment.id,
        subscription_id: subscriptionId,
        receipt_year: receiptNumber.receipt_year,
        receipt_sequence: receiptNumber.receipt_sequence,
        receipt_number: receiptNumber.receipt_number,
        receipt_type: "onboarding",
        amount: totalAmount,
        description,
        customer_copy_label: "COPIA CLIENTE",
        gym_copy_label: "COPIA PALESTRA",
        issued_at: now,
        ...(receiptsHasComponents ? { receipt_components: receiptComponents } : {}),
      });

    if (receiptError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cliente e pagamento creati, ma ricevuta non registrata: ${receiptError.message}`,
          customer_id: customerId,
          payment_id: payment.id,
        },
        { status: 500 },
      );
    }

    if (badgeCode || controllerCode) {
      const { error: credentialError } = await supabase
        .from("access_credentials")
        .upsert(
          {
            customer_id: customerId,
            type: "card",
            code: badgeCode,
            controller_code: controllerCode,
            status: "active",
          },
          { onConflict: "code" },
        );

      if (credentialError) {
        return NextResponse.json(
          {
            ok: false,
            error: `Cliente creato ma credenziale non registrata: ${credentialError.message}`,
            customer_id: customerId,
          },
          { status: 500 },
        );
      }

      await supabase
        .from("customers")
        .update({
          access_activation_status: "badge_assigned",
        })
        .eq("id", customerId);
    }

    if (
      body.medical_certificate_start_date ||
      body.medical_certificate_end_date ||
      body.medical_certificate_url
    ) {
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
      ...(hasDeliveredBadge ? [{
        customer_id: customerId,
        type: "badge",
        title: badgeChargeMode === "charged" ? "Badge RFID consegnato e addebitato" : "Badge RFID consegnato in omaggio",
        description: badgeChargeMode === "charged" ? `Badge RFID consegnato e addebitato €${badgeFee.toFixed(2)}` : `Badge RFID consegnato in omaggio — motivo: ${badgeComplimentaryReason || "non addebitato"}`,
        created_at: now,
      }] : []),
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
      branch_id: customerBranchId,
      receipt_number: receiptNumber.receipt_number,
      steps: { customer: true, membership_fee: true, subscription: Boolean(subscriptionId), payment: true, receipt: true, badge: Boolean(badgeCode || controllerCode), contract_pending: true },
      technical_note: "Il flusso onboarding è multi-step e non ancora una transazione PostgreSQL atomica.",
      next_url: `/customers/${customerId}/contract/print`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Errore onboarding Platinum." },
      { status: 500 },
    );
  }
}
