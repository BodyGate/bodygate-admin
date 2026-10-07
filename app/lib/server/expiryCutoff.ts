// Giorno corrente (YYYY-MM-DD) nel fuso della palestra. L'ultimo giorno di
// validità è inclusivo (come in /api/access/check: valid_until >= today), quindi
// un abbonamento con scadenza = oggi NON è ancora scaduto.
export function expiryCutoffDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
