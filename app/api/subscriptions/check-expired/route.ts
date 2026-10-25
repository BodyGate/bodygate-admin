import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { selectCustomersToExpire } from "../../../lib/server/expiredCustomers";

async function runCheckExpired() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date().toISOString();

    const fail = (message: string) => ({
      ok: false,
      message: "Errore durante il controllo scadenze.",
      error: message,
    });

    // PostgREST caps a single read (1000 rows): page through every candidate
    // with a stable order, and chunk `.in()` lists to keep URLs short.
    const PAGE_SIZE = 1000;
    const CHUNK_SIZE = 100;
    const candidates: { id: string; subscription_expiry: string | null }[] = [];

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page, error: pageError } = await supabase
        .from("customers")
        .select("id, subscription_expiry")
        .lt("subscription_expiry", now)
        .neq("subscription_status", "expired")
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (pageError) return fail(pageError.message);

      candidates.push(...(page || []));

      if (!page || page.length < PAGE_SIZE) break;
    }

    // subscription_expiry is not refreshed on renewal: skip customers that
    // still hold a current subscription (same rule as the access check).
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
    }).format(new Date());
    const currentSubscriptions: { customer_id: string }[] = [];

    for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
      const { data: subs, error: subsError } = await supabase
        .from("customer_subscriptions")
        .select("customer_id")
        .in(
          "customer_id",
          candidates.slice(i, i + CHUNK_SIZE).map((c) => c.id)
        )
        .eq("is_active", true)
        .lte("starts_at", today)
        .gte("ends_at", today)
        .limit(CHUNK_SIZE * 10);

      if (subsError) return fail(subsError.message);

      currentSubscriptions.push(...(subs || []));
    }

    const toExpire = selectCustomersToExpire(candidates, currentSubscriptions);

    const data: { id: string; subscription_expiry: string | null }[] = [];

    for (let i = 0; i < toExpire.length; i += CHUNK_SIZE) {
      const { data: updated, error } = await supabase
        .from("customers")
        .update({
          subscription_status: "expired",
          active: false,
        })
        .in(
          "id",
          toExpire.slice(i, i + CHUNK_SIZE).map((c) => c.id)
        )
        .select("id, subscription_expiry");

      if (error) return fail(error.message);

      data.push(...(updated || []));
    }

    return {
      ok: true,
      message: "Controllo scadenze completato.",
      expired_count: data.length,
      expired_customers: data,
      checked_at: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      ok: false,
      message: "Errore server durante il controllo abbonamenti.",
      error: err?.message || "Unknown error",
    };
  }
}

export async function POST() {
  const result = await runCheckExpired();

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
  });
}

export async function GET() {
  const result = await runCheckExpired();

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
  });
}