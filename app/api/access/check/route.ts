import { createClient } from "@supabase/supabase-js";
import { after, NextResponse } from "next/server";
import { rfidLookupCodes } from "../../../utils/rfid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "BodyGate access check API attiva",
    method: "POST required",
  });
}

type BadgeSource = "access_credentials" | "customer_badges" | "customers";

type BadgeMatch = {
  source: BadgeSource;
  credential_id: string | null;
  customer_id: string;
  badge_code: string;
  controller_code: string;
};

type BadgeLookupDebug = {
  received_badge: string;
  credential_found: boolean;
  credential_id: string | null;
  credential_customer_id: string | null;
  customer_found: boolean | null;
  access_credentials_same_code_count: number | null;
  exact_query_path_used: string[];
  lookup_error: string | null;
};

function normalizeBadge(value: unknown) {
  return String(value || "").trim();
}

function timingHeaders(timings: {
  badgeLookupMs: number;
  customerLookupMs: number;
  policyChecksMs: number;
  totalMs: number;
}) {
  return {
    "Server-Timing": [
      `badge;dur=${timings.badgeLookupMs}`,
      `customer;dur=${timings.customerLookupMs}`,
      `policy;dur=${timings.policyChecksMs}`,
      `total;dur=${timings.totalMs}`,
    ].join(", "),
  };
}

async function findBadgeMatch(
  supabase: ReturnType<typeof getSupabaseClient>,
  badge: string
): Promise<{
  match: BadgeMatch | null;
  debug: BadgeLookupDebug;
}> {
  const lookupCodes = rfidLookupCodes(badge);
  const lookupFilter = lookupCodes
    .map((code) => `code.eq.${code},controller_code.eq.${code}`)
    .join(",");
  const badgeFilter = lookupCodes.map((code) => `badge_code.eq.${code}`).join(",");
  const customerFilter = lookupCodes
    .map((code) => `badge_code.eq.${code},controller_code.eq.${code}`)
    .join(",");
  const exactQueryPathUsed = [
    "access_credentials.status=active AND normalized(code/controller_code)=badge",
  ];

  const { data: accessCredential, error: accessCredentialError } =
    await supabase
      .from("access_credentials")
      .select("id, customer_id, code, controller_code, status, type")
      .eq("status", "active")
      .or(lookupFilter)
      .limit(1)
      .maybeSingle();

  if (accessCredentialError) {
    console.error("access_credentials badge lookup failed", {
      badge,
      error: accessCredentialError.message,
    });
  }

  if (accessCredential?.customer_id) {
    return {
      match: {
        source: "access_credentials",
        credential_id: accessCredential.id ?? null,
        customer_id: accessCredential.customer_id,
        badge_code: accessCredential.code || badge,
        controller_code: accessCredential.controller_code || badge,
      },
      debug: {
        received_badge: badge,
        credential_found: true,
        credential_id: accessCredential.id ?? null,
        credential_customer_id: accessCredential.customer_id,
        customer_found: null,
        access_credentials_same_code_count: null,
        exact_query_path_used: exactQueryPathUsed,
        lookup_error: String((accessCredentialError as any)?.message || ""),
      },
    };
  }

  exactQueryPathUsed.push(
    "customer_badges.normalized(badge_code)=badge AND is_active=true"
  );

  const { data: customerBadge, error: customerBadgeError } = await supabase
    .from("customer_badges")
    .select("id, customer_id, badge_code, is_active")
    .or(badgeFilter)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (customerBadgeError) {
    console.error("customer_badges fallback lookup failed", {
      badge,
      error: customerBadgeError.message,
    });
  }

  if (customerBadge?.customer_id) {
    return {
      match: {
        source: "customer_badges",
        credential_id: null,
        customer_id: customerBadge.customer_id,
        badge_code: customerBadge.badge_code || badge,
        controller_code: badge,
      },
      debug: {
        received_badge: badge,
        credential_found: false,
        credential_id: null,
        credential_customer_id: null,
        customer_found: null,
        access_credentials_same_code_count: null,
        exact_query_path_used: exactQueryPathUsed,
        lookup_error: String(
          (accessCredentialError as any)?.message ||
            (customerBadgeError as any)?.message ||
            ""
        ),
      },
    };
  }

  exactQueryPathUsed.push(
    "customers.normalized(badge_code/controller_code)=badge"
  );

  const { data: customerByLegacyBadge, error: customerByLegacyBadgeError } =
    await supabase
      .from("customers")
      .select("id, badge_code, controller_code")
      .or(customerFilter)
      .limit(1)
      .maybeSingle();

  if (customerByLegacyBadgeError) {
    console.error("customers legacy badge fallback lookup failed", {
      badge,
      error: customerByLegacyBadgeError.message,
    });
  }

  if (customerByLegacyBadge?.id) {
    return {
      match: {
        source: "customers",
        credential_id: null,
        customer_id: customerByLegacyBadge.id,
        badge_code: customerByLegacyBadge.badge_code || badge,
        controller_code: customerByLegacyBadge.controller_code || badge,
      },
      debug: {
        received_badge: badge,
        credential_found: false,
        credential_id: null,
        credential_customer_id: null,
        customer_found: null,
        access_credentials_same_code_count: null,
        exact_query_path_used: exactQueryPathUsed,
        lookup_error:
          (accessCredentialError as any)?.message ||
          (customerBadgeError as any)?.message ||
          (customerByLegacyBadgeError as any)?.message ||
          null,
      },
    };
  }

  const { count: accessCredentialsSameCodeCount, error: accessCountError } =
    await supabase
      .from("access_credentials")
      .select("id", { count: "exact", head: true })
      .or(lookupFilter);

  if (accessCountError) {
    console.error("access_credentials debug count failed", {
      badge,
      error: accessCountError.message,
    });
  }

  return {
    match: null,
    debug: {
      received_badge: badge,
      credential_found: false,
      credential_id: null,
      credential_customer_id: null,
      customer_found: null,
      access_credentials_same_code_count: accessCredentialsSameCodeCount,
      exact_query_path_used: exactQueryPathUsed,
      lookup_error:
        (accessCredentialError as any)?.message ||
        (customerBadgeError as any)?.message ||
        (customerByLegacyBadgeError as any)?.message ||
        (accessCountError as any)?.message ||
        null,
    },
  };
}

async function findStaffAccess(
  supabase: ReturnType<typeof getSupabaseClient>,
  badge: string,
  source: string
) {
  const lookupCodes = rfidLookupCodes(badge);
  const lookupFilter = lookupCodes
    .map((code) => `code.eq.${code},controller_code.eq.${code}`)
    .join(",");
  const { data: staffCredential, error: staffCredentialError } = await supabase
    .from("staff_access_credentials")
    .select("id, staff_user_id, code, controller_code, type, status")
    .eq("status", "active")
    .or(lookupFilter)
    .limit(1)
    .maybeSingle();

  if (staffCredentialError) {
    console.error("staff_access_credentials lookup failed", {
      badge,
      error: staffCredentialError.message,
    });

    return null;
  }

  if (!staffCredential?.staff_user_id) {
    return null;
  }

  const { data: staffUser, error: staffUserError } = await supabase
    .from("staff_users")
    .select(
      `
      id,
      full_name,
      email,
      phone,
      is_active,
      role_id,
      staff_roles (
        role_key,
        role_name
      )
    `
    )
    .eq("id", staffCredential.staff_user_id)
    .limit(1)
    .maybeSingle();

  if (staffUserError) {
    console.error("staff_users lookup failed", {
      staff_user_id: staffCredential.staff_user_id,
      error: staffUserError.message,
    });

    return {
      ok: true,
      allowed: false,
      reason: "Staff non valido",
      badge_code: badge,
      entity_type: "staff",
      customer_id: null,
      customer_name: "Staff non valido",
    };
  }

  if (!staffUser || staffUser.is_active === false) {
    return {
      ok: true,
      allowed: false,
      reason: "Staff non attivo",
      badge_code: badge,
      entity_type: "staff",
      staff_user_id: staffCredential.staff_user_id,
      customer_id: null,
      customer_name: "Staff non attivo",
    };
  }

  const staffName = staffUser.full_name || "Staff BodyGate";
  const staffRole = (staffUser.staff_roles as any)?.role_name || null;

  after(async () => {
    const { error } = await supabase.from("customer_access_logs").insert({
      customer_id: null,
      branch_id: null,
      was_allowed: true,
      reason: `Accesso staff autorizzato: ${staffName}`,
      badge_code: staffCredential.code || badge,
      controller_code: staffCredential.controller_code || badge,
    });

    if (error) {
      console.error("staff customer_access_logs insert failed", {
        staff_user_id: staffUser.id,
        error: error.message,
      });
    }
  });

  return {
    ok: true,
    allowed: true,
    reason: "Accesso staff autorizzato",

    entity_type: "staff",

    staff_user_id: staffUser.id,
    staff_name: staffName,
    staff_role: staffRole,

    // Compatibilità con BodyGate Bridge attuale
    customer_id: null,
    customer_name: staffName,

    badge_code: staffCredential.code || badge,
    controller_code: staffCredential.controller_code || badge,

    source,
  };
}

export async function POST(req: Request) {
  const requestStartedAt = Date.now();

  try {
    const body = await req.json();

    const badge = normalizeBadge(body.badge || body.badge_code || body.code);
    const source = normalizeBadge(body.source) || "turnstile";

    if (!badge) {
      return NextResponse.json({
        ok: false,
        allowed: false,
        reason: "Badge mancante",
      });
    }

    const supabase = getSupabaseClient();

    const badgeLookupStartedAt = Date.now();
    const badgeLookup = await findBadgeMatch(supabase, badge);
    const badgeLookupMs = Date.now() - badgeLookupStartedAt;

    if (!badgeLookup.match) {
      const staffResult = await findStaffAccess(supabase, badge, source);

      if (staffResult) {
        return NextResponse.json(staffResult);
      }

      await supabase.from("unknown_badge_logs").insert({
        badge_code: badge,
        reason: "Badge non riconosciuto",
        source,
      });

      return NextResponse.json({
        ok: false,
        allowed: false,
        reason: "Badge non riconosciuto",
        badge_code: badge,
        debug: {
          searched: [
            "access_credentials.code",
            "access_credentials.controller_code",
            "customer_badges.badge_code",
            "customers.badge_code",
            "customers.controller_code",
            "staff_access_credentials.code",
            "staff_access_credentials.controller_code",
          ],
          access_credentials_status_filter: "active",
          received_badge: badgeLookup.debug.received_badge,
          credential_found: badgeLookup.debug.credential_found,
          credential_id: badgeLookup.debug.credential_id,
          credential_customer_id: badgeLookup.debug.credential_customer_id,
          customer_found: badgeLookup.debug.customer_found,
          access_credentials_same_code_count:
            badgeLookup.debug.access_credentials_same_code_count,
          exact_query_path_used: [
            ...badgeLookup.debug.exact_query_path_used,
            "staff_access_credentials.status=active AND (code=badge OR controller_code=badge)",
          ],
          lookup_error: badgeLookup.debug.lookup_error,
        },
      });
    }

    const badgeMatch = badgeLookup.match;

    const customerLookupStartedAt = Date.now();
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", badgeMatch.customer_id)
      .limit(1)
      .maybeSingle();
    const customerLookupMs = Date.now() - customerLookupStartedAt;

    if (customerError || !customer || customer.is_active === false) {
      await supabase.from("unknown_badge_logs").insert({
        badge_code: badge,
        reason: "Badge associato a cliente non attivo",
        source,
      });

      return NextResponse.json({
        ok: false,
        allowed: false,
        reason: "Cliente non attivo",
        badge_code: badge,
        credential_source: badgeMatch.source,
      });
    }

    const customerId = customer.id;
    const branchId = customer.branch_id;
    const today = new Date().toISOString().slice(0, 10);

    async function logAccess(wasAllowed: boolean, reason: string) {
      const { error } = await supabase.from("customer_access_logs").insert({
        customer_id: customerId,
        branch_id: branchId,
        was_allowed: wasAllowed,
        reason,
        badge_code: badgeMatch.badge_code,
        controller_code: badgeMatch.controller_code,
      });

      if (error) {
        console.error("customer_access_logs insert failed", {
          customer_id: customerId,
          was_allowed: wasAllowed,
          error: error.message,
        });
      }
    }

    async function markPresenceInside() {
      const { error: closePresenceError } = await supabase
        .from("gym_presence")
        .update({
          is_inside: false,
          exited_at: new Date().toISOString(),
        })
        .eq("customer_id", customerId)
        .eq("is_inside", true);

      if (closePresenceError) {
        console.error("gym_presence close previous presence failed", {
          customer_id: customerId,
          error: closePresenceError.message,
        });
      }

      const { error: insertPresenceError } = await supabase
        .from("gym_presence")
        .insert({
          customer_id: customerId,
          branch_id: branchId,
          badge_code: badgeMatch.badge_code,
          is_inside: true,
          source: "turnstile",
        });

      if (insertPresenceError) {
        console.error("gym_presence insert failed", {
          customer_id: customerId,
          error: insertPresenceError.message,
        });
      }
    }

    if (!branchId) {
      await logAccess(false, "Cliente non associato a nessuna sede");

      return NextResponse.json({
        ok: true,
        allowed: false,
        reason: "Cliente non associato a nessuna sede",
        customer_id: customerId,
        badge_code: badgeMatch.badge_code,
        credential_source: badgeMatch.source,
      });
    }

    const policyChecksStartedAt = Date.now();
    const nowIso = new Date().toISOString();

    const [
      activeBlockResult,
      membershipSettingResult,
      validMembershipFeeResult,
      validSubscriptionResult,
    ] = await Promise.all([
      supabase
        .from("customer_blocks")
        .select("reason, ends_at")
        .eq("customer_id", customerId)
        .eq("is_active", true)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("membership_fee_settings")
        .select("required_for_access")
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("customer_membership_fees")
        .select("id, valid_from, valid_until")
        .eq("customer_id", customerId)
        .eq("branch_id", branchId)
        .lte("valid_from", today)
        .gte("valid_until", today)
        .order("valid_until", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("customer_subscriptions")
        .select("id, customer_id, starts_at, ends_at, is_active")
        .eq("customer_id", customerId)
        .eq("is_active", true)
        .lte("starts_at", today)
        .gte("ends_at", today)
        .order("ends_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const policyChecksMs = Date.now() - policyChecksStartedAt;
    const activeBlock = activeBlockResult.data;
    const membershipSetting = membershipSettingResult.data;
    const validMembershipFee = validMembershipFeeResult.data;
    const validSubscription = validSubscriptionResult.data;

    if (activeBlock) {
      const reason = `Accesso bloccato: ${activeBlock.reason}`;
      await logAccess(false, reason);

      return NextResponse.json({
        ok: true,
        allowed: false,
        reason,
        customer_id: customerId,
        badge_code: badgeMatch.badge_code,
        credential_source: badgeMatch.source,
      });
    }

    const medicalCertificateStart =
      customer.medical_certificate_start_date || customer.medical_certificate_start;
    const medicalCertificateEnd =
      customer.medical_certificate_end_date || customer.medical_certificate_end;
    const medicalCertificateStatus = String(
      customer.medical_certificate_status || ""
    ).toLowerCase();

    if (
      !medicalCertificateStart ||
      !medicalCertificateEnd ||
      medicalCertificateStart > today ||
      medicalCertificateEnd < today ||
      medicalCertificateStatus === "expired"
    ) {
      await logAccess(false, "Certificato medico scaduto o mancante");

      return NextResponse.json({
        ok: true,
        allowed: false,
        reason: "Certificato medico scaduto o mancante",
        customer_id: customerId,
        badge_code: badgeMatch.badge_code,
        credential_source: badgeMatch.source,
      });
    }

    if (membershipSetting?.required_for_access && !validMembershipFee) {
      await logAccess(false, "Quota associativa assente o scaduta");

      return NextResponse.json({
        ok: true,
        allowed: false,
        reason: "Quota associativa assente o scaduta",
        customer_id: customerId,
        badge_code: badgeMatch.badge_code,
        credential_source: badgeMatch.source,
      });
    }

    if (!validSubscription) {
      await logAccess(false, "Abbonamento assente o scaduto");

      return NextResponse.json({
        ok: true,
        allowed: false,
        reason: "Abbonamento assente o scaduto",
        customer_id: customerId,
        badge_code: badgeMatch.badge_code,
        credential_source: badgeMatch.source,
      });
    }

    const totalMs = Date.now() - requestStartedAt;

    console.info("[BodyGate access timing]", {
      badge,
      customer_id: customerId,
      credential_source: badgeMatch.source,
      badge_lookup_ms: badgeLookupMs,
      customer_lookup_ms: customerLookupMs,
      policy_checks_ms: policyChecksMs,
      total_before_response_ms: totalMs,
    });

    after(async () => {
      const postResponseStartedAt = Date.now();

      await Promise.all([
        logAccess(true, "Accesso consentito"),
        markPresenceInside(),
      ]);

      console.info("[BodyGate access post-response]", {
        badge,
        customer_id: customerId,
        persistence_ms: Date.now() - postResponseStartedAt,
      });
    });

    return NextResponse.json(
      {
        ok: true,
        allowed: true,
        reason: "Accesso consentito",
        entity_type: "customer",
        customer_id: customerId,
        badge_code: badgeMatch.badge_code,
        controller_code: badgeMatch.controller_code,
        credential_source: badgeMatch.source,
        customer_name:
          `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
      },
      {
        headers: timingHeaders({
          badgeLookupMs,
          customerLookupMs,
          policyChecksMs,
          totalMs,
        }),
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Errore interno";

    return NextResponse.json(
      {
        ok: false,
        allowed: false,
        reason: message,
      },
      { status: 500 }
    );
  }
}
