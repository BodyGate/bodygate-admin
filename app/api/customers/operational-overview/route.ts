import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type QueryResult<T> = {
  data: T | null;
  error: string | null;
  readable: boolean;
};

function admin() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

function todayOnly() {
  return new Date().toISOString().slice(0, 10);
}

function isCredentialActive(row: any) {
  return (
    row?.is_active === true ||
    String(row?.status || "").toLowerCase() === "active"
  );
}

function isOfficialPlanName(name: unknown) {
  return new Set([
    "Mensile",
    "Trimestrale",
    "Semestrale",
    "Annuale",
    "Annuale ridotto Lun Mer Ven",
    "Annuale ridotto Mar Gio Sab",
    "Mensile Ridotto Lunedi-Mercoledi-Venerdi",
    "Mensile Ridotto Martedi-Giovedi-Sabato",
    "Pilates",
  ]).has(String(name || "").trim());
}

function toNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function sameDay(a: unknown, b: unknown) {
  const da = String(a || "").slice(0, 10);
  const db = String(b || "").slice(0, 10);
  return Boolean(da && db && da === db);
}

function isSubscriptionEvidence(payment: any, receipt: any) {
  const description = String(
    payment?.description || receipt?.description || "",
  ).toLowerCase();
  return (
    payment?.type === "subscription" ||
    payment?.payment_type === "subscription" ||
    receipt?.receipt_type === "subscription" ||
    (receipt?.subscription_id && receipt?.receipt_type === "subscription") ||
    ((payment?.type === "subscription" ||
      payment?.payment_type === "subscription" ||
      receipt?.receipt_type === "subscription") &&
      description.includes("rinnovo"))
  );
}

function daysRemaining(endDate: string | null, today: string) {
  if (!endDate) return null;
  return Math.ceil(
    (new Date(`${endDate}T00:00:00`).getTime() -
      new Date(`${today}T00:00:00`).getTime()) /
      86400000,
  );
}

async function safe<T>(
  label: string,
  fn: () => PromiseLike<{ data: T | null; error: any }>,
): Promise<QueryResult<T>> {
  try {
    const { data, error } = await fn();
    if (error)
      return {
        data: null,
        error: `${label}: ${error.message || "query non leggibile"}`,
        readable: false,
      };
    return { data: data ?? null, error: null, readable: true };
  } catch (error) {
    return {
      data: null,
      error: `${label}: ${error instanceof Error ? error.message : "errore imprevisto"}`,
      readable: false,
    };
  }
}

export async function GET(req: Request) {
  const db = admin();
  if (!db)
    return NextResponse.json(
      { ok: false, error: "Configurazione Supabase service role mancante." },
      { status: 500 },
    );

  const url = new URL(req.url);
  const customerId = String(url.searchParams.get("customer_id") || "").trim();
  if (!UUID_RE.test(customerId))
    return NextResponse.json(
      { ok: false, error: "customer_id non valido." },
      { status: 400 },
    );

  const today = todayOnly();
  const warnings: string[] = [];
  const administrativeWarnings: string[] = [];
  const accessBlockReasons: string[] = [];

  const customerQ = await safe<any>("customers", () =>
    db.from("customers").select("*").eq("id", customerId).maybeSingle(),
  );
  if (!customerQ.readable)
    return NextResponse.json(
      { ok: false, error: customerQ.error },
      { status: 500 },
    );
  if (!customerQ.data)
    return NextResponse.json(
      { ok: false, error: "Cliente non trovato." },
      { status: 404 },
    );
  const customer = customerQ.data;

  const [
    branchQ,
    subscriptionsQ,
    feesQ,
    blocksQ,
    credentialsQ,
    dnakeQ,
    mobileQ,
    logsQ,
    paymentsQ,
    receiptsQ,
  ] = await Promise.all([
    customer.branch_id
      ? safe<any>("branches", () =>
          db
            .from("branches")
            .select("id,name,address,city")
            .eq("id", customer.branch_id)
            .maybeSingle(),
        )
      : Promise.resolve({ data: null, error: null, readable: true }),
    safe<any[]>("customer_subscriptions", () =>
      db
        .from("customer_subscriptions")
        .select(
          "*, subscription_plans(id,name,price,promo_price,duration_days,branch_id,is_active)",
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ),
    safe<any[]>("customer_membership_fees", () =>
      db
        .from("customer_membership_fees")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ),
    safe<any[]>("customer_blocks", () =>
      db
        .from("customer_blocks")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ),
    safe<any[]>("access_credentials", () =>
      db
        .from("access_credentials")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ),
    safe<any[]>("customer_dnake_users", () =>
      db
        .from("customer_dnake_users")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ),
    safe<any[]>("customer_mobile_passes", () =>
      db
        .from("customer_mobile_passes")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ),
    safe<any[]>("customer_access_logs", () =>
      db
        .from("customer_access_logs")
        .select("*")
        .eq("customer_id", customerId)
        .order("access_time", { ascending: false })
        .limit(1),
    ),
    safe<any[]>("customer_payments", () =>
      db
        .from("customer_payments")
        .select("*")
        .eq("customer_id", customerId)
        .order("paid_at", { ascending: false }),
    ),
    safe<any[]>("customer_receipts", () =>
      db
        .from("customer_receipts")
        .select("*")
        .eq("customer_id", customerId)
        .order("issued_at", { ascending: false }),
    ),
  ]);

  [
    branchQ,
    subscriptionsQ,
    feesQ,
    blocksQ,
    credentialsQ,
    dnakeQ,
    mobileQ,
    logsQ,
    paymentsQ,
    receiptsQ,
  ].forEach((q) => {
    if (!q.readable && q.error) warnings.push(q.error);
  });

  const subscriptions = subscriptionsQ.data || [];
  const activeSubscription =
    subscriptions.find(
      (s) =>
        s.is_active !== false &&
        String(s.starts_at || "").slice(0, 10) <= today &&
        String(s.ends_at || "").slice(0, 10) >= today,
    ) || null;
  const plannedSubscription =
    subscriptions.find(
      (s) =>
        s.is_active !== false && String(s.starts_at || "").slice(0, 10) > today,
    ) || null;
  const latestSubscription = subscriptions[0] || null;
  const linkedPlan =
    activeSubscription?.subscription_plans ||
    plannedSubscription?.subscription_plans ||
    latestSubscription?.subscription_plans ||
    null;
  const planId =
    activeSubscription?.plan_id ||
    plannedSubscription?.plan_id ||
    latestSubscription?.plan_id ||
    null;
  const planResolved = Boolean(linkedPlan?.id);
  if (activeSubscription && !planId)
    administrativeWarnings.push("Piano da associare");
  if (activeSubscription && planId && !planResolved)
    administrativeWarnings.push("Piano abbonamento orfano");
  if (linkedPlan?.name && !isOfficialPlanName(linkedPlan.name))
    administrativeWarnings.push(
      "Piano non presente nell’elenco ufficiale BodyGate",
    );

  const branchAssigned = Boolean(customer.branch_id);
  const branchResolved = Boolean(branchQ.data?.id);
  if (!branchAssigned) accessBlockReasons.push("Sede mancante");
  if (branchAssigned && !branchResolved)
    administrativeWarnings.push("Sede assegnata — dettagli non disponibili");

  const activeMembershipFee =
    (feesQ.data || []).find(
      (f) =>
        String(f.valid_from || "").slice(0, 10) <= today &&
        String(f.valid_until || "").slice(0, 10) >= today,
    ) || null;
  const activeBlock =
    (blocksQ.data || []).find(
      (b) => b.is_active && (!b.ends_at || new Date(b.ends_at) >= new Date()),
    ) || null;
  const cardCredential =
    (credentialsQ.data || []).find(
      (c) =>
        ["card", "nfc"].includes(String(c.type || "")) && isCredentialActive(c),
    ) || null;
  const badgeOperative = Boolean(
    (customer.badge_code || cardCredential?.code) &&
    (customer.controller_code || cardCredential?.controller_code),
  );
  const dnakeQr =
    (dnakeQ.data || []).find((d) => d.qr_status === "active") ||
    (dnakeQ.data || [])[0] ||
    null;
  const qrOperative = Boolean(
    dnakeQr?.qr_status === "active" &&
    (dnakeQr?.qr_payload || dnakeQr?.controller_code),
  );
  const mobilePass = (mobileQ.data || [])[0] || null;
  const certEnd =
    customer.medical_certificate_end_date || customer.medical_certificate_end;
  const certificateValid = Boolean(
    certEnd && String(certEnd).slice(0, 10) >= today,
  );

  if (customer.is_active === false)
    accessBlockReasons.push("Cliente disattivo");
  if (!badgeOperative && !qrOperative)
    accessBlockReasons.push("Nessuna credenziale operativa");
  if (!certificateValid) accessBlockReasons.push("Certificato non valido");
  if (!activeMembershipFee) accessBlockReasons.push("Quota non valida");
  if (!activeSubscription) accessBlockReasons.push("Abbonamento non valido");
  if (activeBlock)
    accessBlockReasons.push(
      `Blocco attivo${activeBlock.reason ? `: ${activeBlock.reason}` : ""}`,
    );

  if (!dnakeQr && badgeOperative)
    administrativeWarnings.push("QR DNake opzionale non generato");
  if (!mobilePass) administrativeWarnings.push("Mobile Pass non generato");
  if (!customer.contract_status || customer.contract_status !== "signed")
    administrativeWarnings.push("Contratto mancante o non firmato");
  if (!customer.birth_date || !customer.fiscal_code || !customer.phone)
    administrativeWarnings.push("Dati anagrafici incompleti");
  if (customer.subscription_status === "active" && !activeSubscription)
    warnings.push(
      "Stato denormalizzato abbonamento non coerente con customer_subscriptions",
    );

  const customerPayments = paymentsQ.data || [];
  const receipts = receiptsQ.data || [];
  const accountingPaymentsQ = await safe<any[]>("payments", () =>
    db
      .from("payments")
      .select("*")
      .eq("customer_id", customerId)
      .order("paid_at", { ascending: false }),
  );
  if (!accountingPaymentsQ.readable && accountingPaymentsQ.error) {
    warnings.push(accountingPaymentsQ.error);
  }
  const accountingPayments = accountingPaymentsQ.data || [];
  const latestCustomerRenewalPayment =
    customerPayments.find((p) => {
      const receipt =
        receipts.find((r) => p?.id && r.payment_id === p.id) || null;
      return isSubscriptionEvidence(p, receipt);
    }) || null;
  const latestAccountingRenewalPayment =
    accountingPayments.find((p) => p.payment_type === "subscription") || null;
  const latestPayment =
    latestCustomerRenewalPayment || latestAccountingRenewalPayment || null;
  const latestReceipt = latestPayment
    ? receipts.find(
        (r) =>
          r.payment_id === latestPayment.id &&
          isSubscriptionEvidence(latestPayment, r),
      ) || null
    : null;

  const onboardingPayment =
    customerPayments.find((p) => p.type === "onboarding") || null;
  const onboardingReceipt = onboardingPayment
    ? receipts.find(
        (r) =>
          r.payment_id === onboardingPayment.id ||
          r.receipt_type === "onboarding",
      ) || null
    : null;
  const onboardingSubscription = onboardingReceipt?.subscription_id
    ? subscriptions.find((s) => s.id === onboardingReceipt.subscription_id) ||
      activeSubscription ||
      latestSubscription
    : activeSubscription || latestSubscription;
  const onboardingMembershipFee =
    activeMembershipFee || (feesQ.data || [])[0] || null;
  const expectedTotal =
    toNumber(onboardingSubscription?.amount) +
    toNumber(onboardingMembershipFee?.amount);

  const onboardingAccountingPayments = accountingPayments.filter(
    (p) => p.payment_type === "onboarding",
  );
  const accountingPayment =
    onboardingAccountingPayments.find(
      (p) =>
        sameDay(
          p.paid_at || p.created_at,
          onboardingPayment?.paid_at || onboardingPayment?.created_at,
        ) ||
        toNumber(p.amount) === toNumber(onboardingReceipt?.amount) ||
        String(p.description || "").trim() ===
          String(onboardingPayment?.description || "").trim(),
    ) ||
    onboardingAccountingPayments[0] ||
    null;
  const onboardingAmounts = [
    toNumber(onboardingPayment?.amount),
    toNumber(accountingPayment?.amount),
    toNumber(onboardingReceipt?.amount),
    expectedTotal,
  ].filter((value) => value > 0);
  const maxOnboardingAmount = onboardingAmounts.length
    ? Math.max(...onboardingAmounts)
    : 0;
  const minOnboardingAmount = onboardingAmounts.length
    ? Math.min(...onboardingAmounts)
    : 0;
  const onboardingDiscrepancy = Number(
    (maxOnboardingAmount - minOnboardingAmount).toFixed(2),
  );
  const onboardingReasons = [];
  if (
    onboardingPayment &&
    accountingPayment &&
    toNumber(onboardingPayment.amount) !== toNumber(accountingPayment.amount)
  )
    onboardingReasons.push("customer_payment diverso dal registro payments");
  if (
    onboardingPayment &&
    onboardingReceipt &&
    toNumber(onboardingPayment.amount) !== toNumber(onboardingReceipt.amount)
  )
    onboardingReasons.push("customer_payment diverso dalla ricevuta");
  if (
    onboardingReceipt &&
    expectedTotal > 0 &&
    toNumber(onboardingReceipt.amount) !== expectedTotal
  )
    onboardingReasons.push("ricevuta diversa dai componenti attesi");
  const latestOnboardingPayment = onboardingPayment
    ? {
        customer_payment: onboardingPayment,
        payment: accountingPayment,
        receipt: onboardingReceipt,
        subscription: onboardingSubscription,
        membership_fee: onboardingMembershipFee,
        expected_total: expectedTotal || null,
        reconciliation_status:
          onboardingDiscrepancy > 0 ? "mismatch" : "reconciled",
        discrepancy_amount: onboardingDiscrepancy,
        discrepancy_reasons: onboardingReasons,
      }
    : null;

  const subForSummary = activeSubscription || plannedSubscription || null;
  const displayName = activeSubscription
    ? planResolved
      ? linkedPlan.name
      : "Abbonamento attivo"
    : plannedSubscription
      ? `Piano pianificato: ${linkedPlan?.name || "Abbonamento"}`
      : "Nessun abbonamento attivo";
  const remaining = activeSubscription
    ? daysRemaining(
        String(activeSubscription.ends_at || "").slice(0, 10),
        today,
      )
    : null;

  return NextResponse.json({
    ok: true,
    customer,
    branch: branchQ.data,
    branch_status: {
      branchAssigned,
      branchResolved,
      branchAccessValid: branchAssigned,
      branchDataWarning: branchAssigned && !branchResolved,
    },
    active_subscription: activeSubscription,
    planned_subscription: plannedSubscription,
    latest_subscription: latestSubscription,
    linked_plan: linkedPlan,
    plan_resolution: {
      planId,
      planResolved,
      status: planResolved ? "resolved" : planId ? "orphan" : "missing",
    },
    subscription_summary: {
      hasActiveSubscription: Boolean(activeSubscription),
      hasPlannedSubscription: Boolean(plannedSubscription),
      planResolved,
      planId,
      planName: linkedPlan?.name || null,
      displayName,
      status: activeSubscription
        ? remaining !== null && remaining <= 7
          ? "In scadenza"
          : "Attivo"
        : plannedSubscription
          ? "Pianificato"
          : "Da rinnovare",
      startsAt: subForSummary?.starts_at || null,
      endsAt: subForSummary?.ends_at || null,
      daysRemaining: remaining,
      amount: subForSummary?.amount ?? null,
      paymentMethod:
        subForSummary?.payment_method || latestPayment?.payment_method || null,
      dataWarning:
        activeSubscription && !planResolved ? "Piano da associare" : null,
    },
    active_membership_fee: activeMembershipFee,
    active_block: activeBlock,
    credentials: { card: cardCredential, badgeOperative, qrOperative },
    dnake_qr: dnakeQr,
    mobile_pass: mobilePass,
    last_access: (logsQ.data || [])[0] || null,
    latest_renewal: latestPayment
      ? {
          payment: latestPayment,
          receipt: latestReceipt,
          subscription: activeSubscription || latestSubscription,
          plan: linkedPlan,
        }
      : null,
    latest_onboarding_payment: latestOnboardingPayment,
    access_block_reasons: accessBlockReasons,
    administrative_warnings: administrativeWarnings,
    data_quality_warnings: warnings,
  });
}
