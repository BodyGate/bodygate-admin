import type { SupabaseClient } from "@supabase/supabase-js";
import type { FailureTimes, LoginAttemptStore } from "../auth/loginThrottle";

const MAX_ROWS = 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;

// Archivio dei tentativi falliti (public.login_attempts, solo service role).
export function createLoginAttemptStore(supabase: SupabaseClient): LoginAttemptStore {
  return {
    async failures({ email, ip, sinceMs }): Promise<FailureTimes> {
      const since = new Date(sinceMs).toISOString();

      // Due query con filtri a parametri (.eq): nessun testo dell'utente entra in
      // un filtro costruito a mano, quindi un'email malevola non puo' far fallire
      // la lettura e aggirare il limite.
      const [byEmail, byIp] = await Promise.all([
        supabase
          .from("login_attempts")
          .select("ip, created_at")
          .eq("email", email)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(MAX_ROWS),
        supabase
          .from("login_attempts")
          .select("created_at")
          .eq("ip", ip)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(MAX_ROWS),
      ]);

      if (byEmail.error || byIp.error) throw new Error("lettura tentativi non riuscita");

      const emailRows = byEmail.data ?? [];
      return {
        email: emailRows.map((row) => Date.parse(row.created_at)),
        pair: emailRows.filter((row) => row.ip === ip).map((row) => Date.parse(row.created_at)),
        ip: (byIp.data ?? []).map((row) => Date.parse(row.created_at)),
      };
    },

    async recordFailure({ email, ip }) {
      const { error } = await supabase.from("login_attempts").insert({ email, ip });
      if (error) throw new Error("scrittura tentativo non riuscita");

      // Pulizia occasionale delle righe vecchie (la tabella non deve crescere).
      if (Math.random() < 0.05) {
        await supabase
          .from("login_attempts")
          .delete()
          .lt("created_at", new Date(Date.now() - RETENTION_MS).toISOString());
      }
    },

    async clearFailures({ email, ip }) {
      const { error } = await supabase.from("login_attempts").delete().eq("email", email).eq("ip", ip);
      if (error) throw new Error("azzeramento tentativi non riuscito");
    },
  };
}
