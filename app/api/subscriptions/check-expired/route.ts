import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function runCheckExpired() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // TODO(logic-agent): se customers.subscription_expiry è di tipo `date` (ultimo giorno
    // di validità, come ends_at in /api/access/check che usa `ends_at >= today`), confrontarlo
    // con un timestamp fa risultare 'expired' un cliente già dal 00:00 dell'ultimo giorno valido
    // (active=false). Verificare il tipo colonna in produzione; se è `date` usare
    // la data odierna (YYYY-MM-DD) invece di toISOString(). Decisione di prodotto/DB: non modificato.
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("customers")
      .update({
        subscription_status: "expired",
        active: false,
      })
      .lt("subscription_expiry", now)
      .neq("subscription_status", "expired")
      .select("id, subscription_expiry");

    if (error) {
      return {
        ok: false,
        message: "Errore durante il controllo scadenze.",
        error: error.message,
      };
    }

    return {
      ok: true,
      message: "Controllo scadenze completato.",
      expired_count: data?.length || 0,
      expired_customers: data || [],
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