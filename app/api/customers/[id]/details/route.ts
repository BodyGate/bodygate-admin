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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseClient();

  try {
    const { id: customerId } = await ctx.params;

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json(
        {
          ok: false,
          error: customerError?.code
            ? `Cliente non trovato o non leggibile. Codice diagnostico: ${customerError.code}.`
            : "Cliente non trovato o non leggibile.",
        },
        { status: customerError ? 500 : 404 }
      );
    }

    let plansQuery = supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (customer.branch_id) {
      plansQuery = plansQuery.eq("branch_id", customer.branch_id);
    }

    const [
      branchRes,
      plansRes,
      subscriptionsRes,
      membershipFeesRes,
      blocksRes,
      notesRes,
      accessLogsRes,
      accessCredentialsRes,
      dnakeUsersRes,
      mobilePassesRes,
    ] = await Promise.all([
      customer.branch_id
        ? supabase
            .from("branches")
            .select("id, name, address, city")
            .eq("id", customer.branch_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      plansQuery,
      supabase
        .from("customer_subscriptions")
        .select("*, subscription_plans(name)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_membership_fees")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_blocks")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_internal_notes")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_access_logs")
        .select("*")
        .eq("customer_id", customerId)
        .order("access_time", { ascending: false })
        .limit(50),
      supabase
        .from("access_credentials")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_dnake_users")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_mobile_passes")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      ok: true,
      customer,
      branch: branchRes.data || null,
      plans: plansRes.data || [],
      subscriptions: subscriptionsRes.data || [],
      membershipFees: membershipFeesRes.data || [],
      blocks: blocksRes.data || [],
      notes: notesRes.data || [],
      accessLogs: accessLogsRes.data || [],
      accessCredentials: accessCredentialsRes.data || [],
      dnakeUsers: dnakeUsersRes.data || [],
      mobilePasses: mobilePassesRes.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore imprevisto durante il caricamento del cliente.",
      },
      { status: 500 }
    );
  }
}
