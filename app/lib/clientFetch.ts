export type BGAsyncStatus =
  | "idle"
  | "initial_loading"
  | "refreshing"
  | "success"
  | "empty"
  | "partial_success"
  | "recoverable_error"
  | "fatal_error"
  | "offline"
  | "permission_denied";

export type BGFetchResult<T> =
  | { ok: true; data: T; status: number; partial?: boolean }
  | { ok: false; status: number; userMessage: string; technicalMessage: string; code: BGAsyncStatus; data?: unknown };

export type BGFetchOptions = RequestInit & {
  timeoutMs?: number;
  userMessage?: string;
  retries?: number;
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function messageForStatus(status: number, fallback?: string): { userMessage: string; code: BGAsyncStatus } {
  if (status === 401 || status === 403) return { userMessage: "Sessione o permessi da verificare. Accedi di nuovo o contatta un amministratore.", code: "permission_denied" };
  if (status >= 500) return { userMessage: fallback || "Servizio momentaneamente non disponibile. Riprova tra poco.", code: "recoverable_error" };
  return { userMessage: fallback || "Operazione non completata. Verifica i dati e riprova.", code: "recoverable_error" };
}

export async function bgFetchJson<T>(url: string, options: BGFetchOptions = {}): Promise<BGFetchResult<T>> {
  const { timeoutMs = 9000, userMessage, retries = 0, ...init } = options;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, status: 0, userMessage: "Connessione assente. Manteniamo i dati già caricati: riprova quando la rete torna disponibile.", technicalMessage: "navigator.onLine=false", code: "offline" };
  }

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: init.signal || controller.signal });
      const text = await response.text();
      let payload: unknown = null;
      if (text) {
        try { payload = JSON.parse(text); }
        catch { payload = { message: text }; }
      }

      if (!response.ok) {
        const mapped = messageForStatus(response.status, userMessage);
        console.warn("[BodyGate fetch]", { url, status: response.status, payload });
        return { ok: false, status: response.status, userMessage: mapped.userMessage, technicalMessage: `HTTP ${response.status}`, code: mapped.code, data: payload };
      }

      return { ok: true, status: response.status, data: payload as T, partial: Boolean((payload as { partial?: unknown } | null)?.partial) };
    } catch (error) {
      lastError = error;
      if (!isAbortError(error) && attempt < retries) {
        attempt += 1;
        continue;
      }
      const code: BGAsyncStatus = isAbortError(error) ? "recoverable_error" : "offline";
      const technicalMessage = error instanceof Error ? error.message : String(error);
      console.warn("[BodyGate fetch]", { url, technicalMessage });
      return { ok: false, status: 0, userMessage: isAbortError(error) ? "Il servizio sta impiegando troppo tempo. Riprova senza perdere i dati già caricati." : (userMessage || "Connessione non disponibile. Riprova tra poco."), technicalMessage, code };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return { ok: false, status: 0, userMessage: userMessage || "Operazione non completata. Riprova.", technicalMessage: lastError instanceof Error ? lastError.message : String(lastError), code: "recoverable_error" };
}
