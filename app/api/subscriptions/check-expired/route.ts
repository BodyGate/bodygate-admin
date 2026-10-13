import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function runCheckExpired() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date().toISOString();

    // TODO(logic-review, decisione di prodotto - non corretto automaticamente):
    // 1. Questo job legge customers.subscription_expiry/subscription_status, ma
    //    renew_subscription_atomic_v1 (security-hotfix-0-3) aggiorna solo
    //    customer_subscriptions e non questi due campi. Scenario: cliente con
    //    subscription_expiry = 2026-09-30 rinnova il 2026-10-02; il job vede
    //    ancora la scadenza vecchia e imposta subscription_status='expired' e
    //    active=false su un cliente con abbonamento valido (la lista clienti
    //    mostra "scaduto"; il gate fisico usa is_active, quindi non e' bloccato).
    //    Valutare: sincronizzare i campi nella RPC, oppure derivare lo stato da
    //    customer_subscriptions.
    // 2. Se subscription_expiry e' di tipo date, il confronto con un timestamp
    //    (`now`) lo considera scaduto dalle 00:00 UTC dell'ultimo giorno valido
    //    invece del giorno dopo. Verificare il tipo colonna (nessun DDL nel repo).
    // 3. GET e POST modificano dati senza controllo permessi in questo handler:
    //    verificare che proxy.ts lo protegga.

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