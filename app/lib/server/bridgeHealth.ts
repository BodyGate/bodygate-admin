// Salute "reale" del bridge del tornello.
//
// Il bridge risponde a /status anche quando non legge piu' nessun badge dal
// DNake (accaduto dal 9 ottobre 2026: il file unlock_sql.db del DNake, oltre
// circa 284 KB, arriva troncato e ogni lettura fallisce). Guardare solo "il
// bridge risponde" faceva risultare tutto online mentre i clienti non
// entravano. Qui la salute si valuta dai campi che il bridge V3.9.4+ espone in
// /status: pollHealthy, dnakeDbPartial, dnakeDbExpectedBytes, lastPollError.

// Osservato sul DNake AC02C (mini_httpd): oltre questo numero di byte il file
// viene consegnato troncato.
export const DNAKE_DB_DEFAULT_LIMIT_BYTES = 290816;

export const DNAKE_DB_WARN_PERCENT = 70;

export type BridgeHealthLevel = "ok" | "warning" | "critical";

export type BridgeHealth = {
  level: BridgeHealthLevel;
  polling_healthy: boolean | null;
  message: string | null;
  suggested_action: string | null;
  reasons: string[];
  db: {
    expected_bytes: number;
    received_bytes: number | null;
    limit_bytes: number;
    percent_of_limit: number;
    partial: boolean;
  } | null;
};

export type BridgeHealthOptions = {
  limitBytes?: number;
  warnPercent?: number;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function shorten(value: unknown, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function evaluateBridgeHealth(
  bridge: Record<string, unknown> | null | undefined,
  options: BridgeHealthOptions = {},
): BridgeHealth {
  const limitBytes =
    asNumber(options.limitBytes) && (options.limitBytes as number) > 0
      ? (options.limitBytes as number)
      : DNAKE_DB_DEFAULT_LIMIT_BYTES;
  const warnPercent = asNumber(options.warnPercent) ?? DNAKE_DB_WARN_PERCENT;

  // Bridge non raggiungibile o versione vecchia senza i campi nuovi: la
  // salute non e' valutabile qui (l'offline lo segnalano gia' gli altri
  // controlli), quindi non si inventa un allarme.
  if (!bridge || typeof bridge !== "object") {
    return {
      level: "ok",
      polling_healthy: null,
      message: null,
      suggested_action: null,
      reasons: [],
      db: null,
    };
  }

  const pollHealthy =
    typeof bridge.pollHealthy === "boolean" ? bridge.pollHealthy : null;
  const partial = bridge.dnakeDbPartial === true;
  const expected = asNumber(bridge.dnakeDbExpectedBytes);
  const received = asNumber(bridge.dnakeDbReceivedBytes);

  const db =
    expected !== null && expected >= 0
      ? {
          expected_bytes: expected,
          received_bytes: received !== null && received >= 0 ? received : null,
          limit_bytes: limitBytes,
          percent_of_limit: Math.round((expected / limitBytes) * 100),
          partial,
        }
      : null;

  const reasons: string[] = [];
  let level: BridgeHealthLevel = "ok";
  let message: string | null = null;
  let suggestedAction: string | null = null;

  if (pollHealthy === false) {
    level = "critical";
    reasons.push("polling_down");

    const detail = shorten(bridge.lastPollError, 160);

    message =
      "Il bridge e' acceso ma non riesce a leggere i badge dal DNake: i clienti non vengono riconosciuti e il tornello non si apre da solo." +
      (detail ? ` Ultimo errore: ${detail}` : "");
    suggestedAction =
      "Usare l'apertura manuale e chiamare l'assistenza. Controllare la dimensione del database del DNake (scripts/dnake-health.ps1).";
  } else if (partial) {
    level = "warning";
    reasons.push("db_partial");
    message =
      "Il DNake consegna il suo registro troncato: i badge si leggono ancora ma il sistema si fermera' presto.";
    suggestedAction =
      "Svuotare i registri del DNake (docs/DNAKE_REPLACEMENT_RUNBOOK.md, manutenzione).";
  } else if (db && db.percent_of_limit >= warnPercent) {
    level = "warning";
    reasons.push("db_near_limit");
    message = `Il registro del DNake e' al ${db.percent_of_limit}% del limite (${Math.round(db.expected_bytes / 1024)} KB su ${Math.round(limitBytes / 1024)} KB): oltre il limite il bridge smette di leggere i badge.`;
    suggestedAction =
      "Svuotare i registri del DNake prima che si riempia (docs/DNAKE_REPLACEMENT_RUNBOOK.md, manutenzione).";
  }

  return {
    level,
    polling_healthy: pollHealthy,
    message,
    suggested_action: suggestedAction,
    reasons,
    db,
  };
}
