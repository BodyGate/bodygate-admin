import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, supabaseServiceKey);
}

function querySubscriptionsPage(
  supabase: ReturnType<typeof getSupabaseClient>,
  from: number,
  pageSize: number,
) {
  return supabase
    .from("customer_subscriptions")
    .select(
      `
      id,
      customer_id,
      starts_at,
      ends_at,
      is_active,
      amount,
      created_at,
      customers (
        id,
        first_name,
        last_name,
        phone,
        badge_code,
        is_active
      ),
      subscription_plans (
        id,
        name,
        is_active
      )
    `
    )
    .order("created_at", { ascending: false })
    .order("starts_at", { ascending: false })
    .order("ends_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
}

// PostgREST enforces its own server-side max row count (1000 on this
// project) regardless of any .limit() the client requests. With 2102 real
// subscriptions, an unpaginated query silently dropped over half of them -
// the same failure mode already fixed for Training's customer list. Page
// through with .range() to fetch the true full set; the existing
// client-side status/filter logic (app/subscriptions/page.tsx) is
// unaffected, it just now runs against complete data.
async function fetchAllSubscriptions(
  supabase: ReturnType<typeof getSupabaseClient>,
) {
  const pageSize = 1000;
  const rows: NonNullable<
    Awaited<ReturnType<typeof querySubscriptionsPage>>["data"]
  > = [];

  for (let from = 0; from < 50000; from += pageSize) {
    const { data, error } = await querySubscriptionsPage(supabase, from, pageSize);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const subscriptions = await fetchAllSubscriptions(supabase);

    return NextResponse.json({ ok: true, subscriptions });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore caricamento abbonamenti.",
      },
      { status: 500 }
    );
  }
}
