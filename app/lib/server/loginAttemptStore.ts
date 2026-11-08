import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoginAttemptStore } from "../auth/loginThrottle";

// Archivio dei tentativi (public.login_attempts) e funzione atomica
// public.reserve_login_attempt: solo service role.
export function createLoginAttemptStore(supabase: SupabaseClient): LoginAttemptStore {
  return {
    async reserve({ email, ip, windowSeconds, limitPair, limitEmail, limitIp }) {
      const { data, error } = await supabase.rpc("reserve_login_attempt", {
        p_email: email,
        p_ip: ip,
        p_window_seconds: windowSeconds,
        p_limit_pair: limitPair,
        p_limit_email: limitEmail,
        p_limit_ip: limitIp,
      });

      if (error) throw new Error("prenotazione tentativo non riuscita");

      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row.allowed !== "boolean") throw new Error("risposta limite non valida");

      return row.allowed
        ? { allowed: true }
        : { allowed: false, retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds) || 1) };
    },

    async clear({ email, ip }) {
      const { error } = await supabase.from("login_attempts").delete().eq("email", email).eq("ip", ip);
      if (error) throw new Error("azzeramento tentativi non riuscito");
    },
  };
}
