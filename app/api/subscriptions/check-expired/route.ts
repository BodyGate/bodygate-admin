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

    const { data: candidates, error: candidatesError } = await supabase
      .from("customers")
      .select("id, subscription_expiry")
      .lt("subscription_expiry", now)
      .neq("subscription_status", "expired");

    if (candidatesError) {
      return {
        ok: false,
        message: "Errore durante il controllo scadenze.",
        error: candidatesError.message,
      };
    }

    // subscription_expiry is not refreshed on renewal: skip customers that
    // still hold a current subscription (same rule as the access check).
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
    }).format(new Date());
    const candidateIds = (candidates || []).map((c) => c.id);
    let currentSubscriptions: { customer_id: string }[] = [];

    if (candidateIds.length > 0) {
      const { data: subs, error: subsError } = await supabase
        .from("customer_subscriptions")
        .select("customer_id")
        .in("customer_id", candidateIds)
        .eq("is_active", true)
        .lte("starts_at", today)
        .gte("ends_at", today);

      if (subsError) {
        return {
          ok: false,
          message: "Errore durante il controllo scadenze.",
          error: subsError.message,
        };
      }

      currentSubscriptions = subs || [];
    }

    const toExpire = selectCustomersToExpire(
      candidates || [],
      currentSubscriptions
    );

    let data: { id: string; subscription_expiry: string | null }[] = [];

    if (toExpire.length > 0) {
      const { data: updated, error } = await supabase
        .from("customers")
        .update({
          subscription_status: "expired",
          active: false,
        })
        .in(
          "id",
          toExpire.map((c) => c.id)
        )
        .select("id, subscription_expiry");

      if (error) {
        return {
          ok: false,
          message: "Errore durante il controllo scadenze.",
          error: error.message,
        };
      }

      data = updated || [];
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