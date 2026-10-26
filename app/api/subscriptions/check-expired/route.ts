import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  runExpiredCustomersCheck,
  type DbLike,
} from "../../../lib/server/expiredCustomers";

async function runCheckExpired(dryRun: boolean) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Same rule as the access check: current day, in the gym's time zone.
    const todayIso = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
    }).format(new Date());

    let outcome;

    try {
      outcome = await runExpiredCustomersCheck(
        supabase as unknown as DbLike,
        { nowIso: new Date().toISOString(), todayIso, dryRun }
      );
    } catch (error) {
      return {
        ok: false,
        message: "Errore durante il controllo scadenze.",
        error: error instanceof Error ? error.message : "Errore database",
      };
    }

    const { candidates, toExpire, expired } = outcome;

    return {
      ok: true,
      message: "Controllo scadenze completato.",
      dry_run: dryRun,
      candidates_count: candidates.length,
      skipped_with_current_subscription: candidates.length - toExpire.length,
      expired_count: dryRun ? toExpire.length : expired.length,
      expired_customers: dryRun ? toExpire : expired,
      checked_at: new Date().toISOString(),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      message: "Errore server durante il controllo abbonamenti.",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// dry_run=1 only reports which customers would be expired, without updating.
function isDryRun(req: Request) {
  return new URL(req.url).searchParams.get("dry_run") === "1";
}

export async function POST(req: Request) {
  const result = await runCheckExpired(isDryRun(req));

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
  });
}

export async function GET(req: Request) {
  const result = await runCheckExpired(isDryRun(req));

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
  });
}
