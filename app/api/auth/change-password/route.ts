import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validateNewPassword } from "../../../lib/auth/passwordPolicy";
import { changePassword } from "../../../lib/server/changePassword";
import type { PasswordStore } from "../../../lib/server/changePassword";
import { authFailureResponse, requireSession } from "../../../lib/server/auth";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function getStore(): PasswordStore {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurazione Supabase server mancante.");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async getHash(userId) {
      const { data, error } = await supabase
        .from("app_users")
        .select("password")
        .eq("id", userId)
        .eq("active", true)
        .maybeSingle();
      if (error) throw new Error("Lettura utente non riuscita.");
      return data?.password ?? null;
    },
    async setHash(userId, hash) {
      const { error } = await supabase.from("app_users").update({ password: hash }).eq("id", userId);
      if (error) throw new Error("Aggiornamento password non riuscito.");
    },
    async audit({ userId, email }) {
      // Mai la password: solo chi e quando.
      const { error } = await supabase.from("audit_logs").insert({
        entity_type: "app_user",
        entity_id: userId,
        action: "password_changed",
        user_email: email,
      });
      if (error) throw new Error("Scrittura audit non riuscita.");
    },
  };
}

/**
 * Cambia la password dell'utente della sessione. Richiede la password attuale.
 * Non serve un permesso: ognuno cambia solo la PROPRIA password.
 * Le sessioni gia' emesse restano valide fino alla scadenza (il token e' senza
 * stato): vedi docs/SECURITY_HOTFIX_0_4.md.
 */
export async function POST(req: Request) {
  try {
    const user = await requireSession();

    const body = (await req.json().catch(() => null)) as {
      currentPassword?: unknown;
      newPassword?: unknown;
    } | null;

    const result = await changePassword(
      {
        store: getStore(),
        validate: validateNewPassword,
        crypto: {
          compare: (plain, hash) => bcrypt.compare(plain, hash),
          hash: (plain) => bcrypt.hash(plain, 12),
        },
      },
      {
        userId: user.id,
        email: user.email,
        current: typeof body?.currentPassword === "string" ? body.currentPassword : "",
        next: typeof body?.newPassword === "string" ? body.newPassword : "",
      },
    );

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers: noStore });
    }
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    const authFailure = authFailureResponse(error);
    if (authFailure) return authFailure;

    // Nessun dettaglio della password o del database nel log.
    console.error("change-password fallito:", error instanceof Error ? error.message : "errore sconosciuto");
    return NextResponse.json(
      { ok: false, error: "Impossibile cambiare la password. Riprova." },
      { status: 500, headers: noStore },
    );
  }
}
