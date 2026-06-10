import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, supabaseServiceKey);
}

function isActiveCustomer(customer: any) {
  return customer?.is_active === true || customer?.active === true || customer?.status === "active";
}

function hasBadge(customer: any) {
  return Boolean(
    String(customer?.badge_code || "").trim() ||
      String(customer?.controller_code || "").trim()
  );
}

function needsVerification(customer: any) {
  const hasNoAccess =
    customer?.access_activation_status &&
    !["active", "enabled", "ok"].includes(String(customer.access_activation_status).toLowerCase());

  const hasNoMedical =
    customer?.medical_certificate_status &&
    !["valid", "ok", "active"].includes(String(customer.medical_certificate_status).toLowerCase());

  return Boolean(hasNoAccess || hasNoMedical);
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();

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

    const total = countQuery.count ?? 0;
    const allCustomers: any[] = [];

    for (let from = 0; from < total; from += PAGE_SIZE) {
      const to = Math.min(from + PAGE_SIZE - 1, total - 1);

      let pageQuery = await supabase
        .from("customers")
        .select(customerFields)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (pageQuery.error) {
        pageQuery = await supabase
          .from("customers")
          .select(customerFields)
          .range(from, to);
      }

      if (pageQuery.error) {
        return NextResponse.json(
          { ok: false, error: pageQuery.error.message },
          { status: 500 }
        );
      }

      allCustomers.push(...(pageQuery.data ?? []));
    }

    const customers = allCustomers.map((customer) => ({
      ...customer,
      full_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
      active: customer.active ?? customer.is_active,
    }));

    const activeCustomers = customers.filter(isActiveCustomer);
    const accessActive = customers.filter(
      (customer) =>
        isActiveCustomer(customer) &&
        String(customer.access_activation_status || "").toLowerCase() === "active"
    );

    const stats = {
      total_customers: activeCustomers.length,
      total_records: customers.length,
      access_active: accessActive.length,
      to_check: customers.filter((customer) => isActiveCustomer(customer) && needsVerification(customer)).length,
      expiring_soon: customers.filter((customer) => {
        if (!customer.medical_certificate_end_date) return false;

        const end = new Date(customer.medical_certificate_end_date);
        if (Number.isNaN(end.getTime())) return false;

        const today = new Date();
        const in30Days = new Date();
        in30Days.setDate(today.getDate() + 30);

        return end >= today && end <= in30Days;
      }).length,
      with_badge: customers.filter((customer) => isActiveCustomer(customer) && hasBadge(customer)).length,
    };

    return NextResponse.json({
      ok: true,
      customers,
      count: customers.length,
      total,
      stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore interno";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}