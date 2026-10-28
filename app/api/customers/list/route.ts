import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { businessTodayISO } from "../../../lib/server/businessDate";
import { evaluateAccessEligibility } from "../../../lib/server/accessEligibility";
import { feeKey, isAccessReady } from "../../../lib/server/accessReadyCount";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

type CustomerRow = Record<string, any>;

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, supabaseServiceKey);
}

function isActiveCustomer(customer: CustomerRow) {
  return (
    customer?.is_active === true &&
    customer?.active !== false &&
    String(customer?.status || "").toLowerCase() !== "inactive"
  );
}

function hasBadge(customer: CustomerRow) {
  return Boolean(
    String(customer?.badge_code || "").trim() ||
      String(customer?.controller_code || "").trim()
  );
}

function needsVerification(customer: CustomerRow) {
  const accessStatus = String(customer?.access_activation_status || "").toLowerCase();
  const medicalStatus = String(customer?.medical_certificate_status || "").toLowerCase();

  const hasNoAccess =
    accessStatus && !["active", "enabled", "ok"].includes(accessStatus);

  const hasNoMedical =
    medicalStatus && !["valid", "ok", "active"].includes(medicalStatus);

  return Boolean(hasNoAccess || hasNoMedical);
}

function applyListFilter(customers: CustomerRow[], filter: string) {
  switch (filter) {
    case "all":
      return customers;

    case "inactive":
      return customers.filter((customer) => !isActiveCustomer(customer));

    case "to_check":
      return customers.filter(
        (customer) => isActiveCustomer(customer) && needsVerification(customer)
      );

    case "with_badge":
      return customers.filter(
        (customer) => isActiveCustomer(customer) && hasBadge(customer)
      );

    case "without_badge":
      return customers.filter(
        (customer) => isActiveCustomer(customer) && !hasBadge(customer)
      );

    case "active":
    default:
      return customers.filter(isActiveCustomer);
  }
}

// Legge tutte le righe di una query a pagine da PAGE_SIZE (Supabase tronca a 1000).
async function fetchAllRows(
  build: () => {
    range: (
      from: number,
      to: number
    ) => PromiseLike<{ data: CustomerRow[] | null; error: { message: string } | null }>;
  }
): Promise<{ ok: true; rows: CustomerRow[] } | { ok: false; error: string }> {
  const rows: CustomerRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) return { ok: false, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { ok: true, rows };
  }
}

const DEFAULT_LIST_LIMIT = 60;
const MAX_LIST_LIMIT = 200;

function customerBadgeCode(customer: CustomerRow) {
  return String(customer?.badge_code || customer?.controller_code || "").trim();
}

function matchesSearch(customer: CustomerRow, query: string) {
  const name = `${customer.first_name || ""} ${customer.last_name || ""}`.trim().toLowerCase();

  return (
    name.includes(query) ||
    String(customer.phone || "").toLowerCase().includes(query) ||
    String(customer.email || "").toLowerCase().includes(query) ||
    customerBadgeCode(customer).toLowerCase().includes(query)
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const filter = request.nextUrl.searchParams.get("status") || "active";
    const query = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_LIST_LIMIT)
      : DEFAULT_LIST_LIMIT;

    const customerFields = [
      "id",
      "first_name",
      "last_name",
      "phone",
      "email",
      "fiscal_code",
      "birth_date",
      "badge_code",
      "controller_code",
      "branch_id",
      "is_active",
      "active",
      "status",
      "subscription_status",
      "subscription_expiry",
      "access_activation_status",
      "payment_status",
      "medical_certificate_status",
      "medical_certificate_start_date",
      "medical_certificate_end_date",
      "created_at",
    ].join(", ");

    const countQuery = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true });

    if (countQuery.error) {
      return NextResponse.json(
        { ok: false, error: countQuery.error.message },
        { status: 500 }
      );
    }

    const totalRecords = countQuery.count ?? 0;
    const allRows: CustomerRow[] = [];

    for (let from = 0; from < totalRecords; from += PAGE_SIZE) {
      const to = Math.min(from + PAGE_SIZE - 1, totalRecords - 1);

      const pageQuery = await supabase
        .from("customers")
        .select(customerFields)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (pageQuery.error) {
        return NextResponse.json(
          { ok: false, error: pageQuery.error.message },
          { status: 500 }
        );
      }

      allRows.push(...(pageQuery.data ?? []));
    }

    const normalizedCustomers: CustomerRow[] = allRows.map((customer): CustomerRow => ({
  ...customer,
  full_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
  active: isActiveCustomer(customer),
}));

    const activeCustomers = normalizedCustomers.filter(isActiveCustomer);

    // "Accesso attivo": quota associativa + abbonamento + certificato medico
    // validi oggi (e nessun blocco), con la stessa regola di /api/access/check.
    const today = businessTodayISO();
    const nowIso = new Date().toISOString();

    const [feeRows, subscriptionRows, blockRows] = await Promise.all([
      fetchAllRows(() =>
        supabase
          .from("customer_membership_fees")
          .select("customer_id, branch_id")
          .lte("valid_from", today)
          .gte("valid_until", today)
      ),
      fetchAllRows(() =>
        supabase
          .from("customer_subscriptions")
          .select("customer_id")
          .eq("is_active", true)
          .lte("starts_at", today)
          .gte("ends_at", today)
      ),
      fetchAllRows(() =>
        supabase
          .from("customer_blocks")
          .select("customer_id")
          .eq("is_active", true)
          .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      ),
    ]);

    for (const result of [feeRows, subscriptionRows, blockRows]) {
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: 500 }
        );
      }
    }

    const accessContext = {
      today,
      feeKeys: new Set(
        (feeRows.ok ? feeRows.rows : []).map((r) =>
          feeKey(String(r.customer_id), String(r.branch_id))
        )
      ),
      subscriptionCustomerIds: new Set(
        (subscriptionRows.ok ? subscriptionRows.rows : []).map((r) =>
          String(r.customer_id)
        )
      ),
      blockedCustomerIds: new Set(
        (blockRows.ok ? blockRows.rows : []).map((r) => String(r.customer_id))
      ),
    };
    const filteredCustomers = applyListFilter(normalizedCustomers, filter);

    const stats = {
      total_customers: activeCustomers.length,
      total_records: normalizedCustomers.length,
      inactive_customers: normalizedCustomers.length - activeCustomers.length,
      access_active: activeCustomers.filter((customer) =>
        isAccessReady(
          evaluateAccessEligibility,
          customer as Parameters<typeof isAccessReady>[1],
          accessContext
        )
      ).length,
      to_check: activeCustomers.filter(needsVerification).length,
      expiring_soon: activeCustomers.filter((customer) => {
        if (!customer.medical_certificate_end_date) return false;

        const endDate = String(customer.medical_certificate_end_date).slice(0, 10);
        if (Number.isNaN(new Date(endDate).getTime())) return false;

        // Confronto tra date (YYYY-MM-DD), come in access/check e reception/dashboard:
        // il certificato è valido fino al giorno di scadenza incluso.
        const today = businessTodayISO();
        const [y, m, d] = today.split("-").map(Number);
        const in30Days = new Date(Date.UTC(y, m - 1, d + 30))
          .toISOString()
          .slice(0, 10);

        return endDate >= today && endDate <= in30Days;
      }).length,
      with_badge: activeCustomers.filter(hasBadge).length,
      without_badge: activeCustomers.filter((customer) => !hasBadge(customer)).length,
    };

    const searchedCustomers = query
      ? filteredCustomers.filter((customer) => matchesSearch(customer, query))
      : filteredCustomers;

    const sortedCustomers = searchedCustomers
      .slice()
      .sort((a, b) =>
        String(a.full_name || "").localeCompare(String(b.full_name || ""), "it", {
          sensitivity: "base",
        })
      );

    const matchedCount = sortedCustomers.length;
    const pageCustomers = sortedCustomers.slice(0, limit);

    return NextResponse.json({
      ok: true,
      customers: pageCustomers,
      count: pageCustomers.length,
      total: filteredCustomers.length,
      total_records: normalizedCustomers.length,
      matched_count: matchedCount,
      has_more: matchedCount > pageCustomers.length,
      query,
      filter,
      stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}