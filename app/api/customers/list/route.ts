import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      "is_active",
      "active",
      "status",
      "subscription_status",
      "subscription_expiry",
      "access_activation_status",
      "payment_status",
      "medical_certificate_status",
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
    const filteredCustomers = applyListFilter(normalizedCustomers, filter);

    const stats = {
      total_customers: activeCustomers.length,
      total_records: normalizedCustomers.length,
      inactive_customers: normalizedCustomers.length - activeCustomers.length,
      access_active: activeCustomers.filter(
        (customer) =>
          String(customer.access_activation_status || "").toLowerCase() === "active"
      ).length,
      to_check: activeCustomers.filter(needsVerification).length,
      expiring_soon: activeCustomers.filter((customer) => {
        if (!customer.medical_certificate_end_date) return false;

        const end = new Date(customer.medical_certificate_end_date);
        if (Number.isNaN(end.getTime())) return false;

        const today = new Date();
        const in30Days = new Date();
        in30Days.setDate(today.getDate() + 30);

        return end >= today && end <= in30Days;
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