import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MAX_ITEMS_PER_SOURCE = 80;

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function safeSelect<T = any>(
  supabase: SupabaseClient,
  table: string,
  queryBuilder: (qb: any) => any
): Promise<T[]> {
  try {
    const base = supabase.from(table);
    const q = queryBuilder(base);
    const { data, error } = await q;

    if (error) {
      console.warn(`[timeline-feed] source non disponibile: ${table}`, error.message);
      return [] as T[];
    }

    return (data || []) as T[];
  } catch (error) {
    console.warn(`[timeline-feed] errore fallback su tabella ${table}`, error);
    return [] as T[];
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseClient();
    const { id: customerId } = await ctx.params;

    const customers = await safeSelect<any>(supabase, "customers", (qb) =>
      qb.select("id, badge_code, first_name, last_name").eq("id", customerId).limit(1)
    );

    const customer = customers[0] || null;
    const directBadgeCode = customer?.badge_code || null;

    const customerBadges = await safeSelect<any>(supabase, "customer_badges", (qb) =>
      qb
        .select("id, badge_code, badge_type, is_primary, is_active, notes, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS_PER_SOURCE)
    );

    const accessCredentials = await safeSelect<any>(supabase, "access_credentials", (qb) =>
      qb
        .select("id, type, code, status, created_at, controller_code")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS_PER_SOURCE)
    );

    const badgeCodes = new Set<string>();

    if (directBadgeCode) badgeCodes.add(String(directBadgeCode));

    customerBadges.forEach((b) => {
      if (b?.badge_code) badgeCodes.add(String(b.badge_code));
    });

    accessCredentials.forEach((c) => {
      if (c?.code) badgeCodes.add(String(c.code));
      if (c?.controller_code) badgeCodes.add(String(c.controller_code));
    });

    const [
      customerAccessLogs,
      subscriptions,
      membershipFees,
      medicalCertificates,
      blocks,
      notes,
      payments,
      customerPayments,
      customerDocuments,
      documents,
      timelineLegacy,
    ] = await Promise.all([
      safeSelect<any>(supabase, "customer_access_logs", (qb) =>
        qb
          .select("id, created_at, access_time, badge_code, controller_code, was_allowed, reason")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>(supabase, "customer_subscriptions", (qb) =>
        qb
          .select("id, created_at, starts_at, ends_at, is_active, amount, payment_method, notes, plan_id")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>(supabase, "customer_membership_fees", (qb) =>
        qb
          .select("id, created_at, paid_at, valid_from, valid_until, amount, payment_method, notes")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>(supabase, "medical_certificates", (qb) =>
        qb
          .select("id, created_at, valid_from, valid_until, expiry_date, status, certificate_type, notes, file_name")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>(supabase, "customer_blocks", (qb) =>
        qb
          .select("id, created_at, starts_at, ends_at, is_active, reason")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>(supabase, "customer_internal_notes", (qb) =>
        qb
          .select("id, created_at, note, is_important, created_by")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>(supabase, "payments", (qb) =>
        qb
          .select("id, created_at, paid_at, amount, status, payment_type, description")
          .eq("customer_id", customerId)
          .order("paid_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>(supabase, "customer_payments", (qb) =>
        qb
          .select("id, created_at, paid_at, amount, type, description, payment_method")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>(supabase, "customer_documents", (qb) =>
        qb
          .select("id, created_at, title, type, document_type, status, notes")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>(supabase, "documents", (qb) =>
        qb
          .select("id, created_at, title, type, file_name, status, signed_at, expires_at")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
      safeSelect<any>(supabase, "customer_timeline", (qb) =>
        qb
          .select("id, created_at, type, title, description")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      ),
    ]);

    const technicalAccessByCustomerId = await safeSelect<any>(supabase, "access_logs", (qb) =>
      qb
        .select("id, created_at, badge_code, controller_code, allowed, reason, event_type")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS_PER_SOURCE)
    );

    let technicalAccessByBadge: any[] = [];
    const badgeArray = Array.from(badgeCodes);

    if (badgeArray.length > 0) {
      technicalAccessByBadge = await safeSelect<any>(supabase, "access_logs", (qb) =>
        qb
          .select("id, created_at, badge_code, controller_code, allowed, reason, event_type")
          .or(
            `badge_code.in.(${badgeArray.map((b) => `"${b}"`).join(",")}),controller_code.in.(${badgeArray
              .map((b) => `"${b}"`)
              .join(",")})`
          )
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS_PER_SOURCE)
      );
    }

    return NextResponse.json({
      ok: true,
      customerAccessLogs,
      technicalAccessByCustomerId,
      technicalAccessByBadge,
      subscriptions,
      membershipFees,
      medicalCertificates,
      blocks,
      notes,
      payments,
      customerPayments,
      customerDocuments,
      documents,
      customerBadges,
      accessCredentials,
      timelineLegacy,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento timeline cliente.",
      },
      { status: 500 }
    );
  }
}
