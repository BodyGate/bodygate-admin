/**
 * Criteri per la nuova password. Logica pura, senza dipendenze, testata in
 * tests/passwordPolicy.test.mjs. Restituisce il messaggio di errore (in italiano,
 * pronto da mostrare) oppure null se la password e' accettabile.
 */
export const MIN_PASSWORD_LENGTH = 12;
// bcrypt considera solo i primi 72 byte: oltre, la password verrebbe troncata
// in silenzio. Meglio rifiutarla che accettare qualcosa di diverso da cio' che
// l'utente crede di aver scelto.
export const MAX_PASSWORD_BYTES = 72;

// Confronto sulla password in minuscolo e senza cifre/simboli.
const OBVIOUS = new Set([
  "password",
  "passwordpassword",
  "bodygate",
  "bodygatebodygate",
  "administrator",
  "admin",
  "qwertyuiop",
  "iloveyou",
]);

export function validateNewPassword(input: {
  current: string;
  next: string;
  email?: string;
}): string | null {
  const { current, next, email } = input;

  if (typeof next !== "string" || next.length < MIN_PASSWORD_LENGTH) {
    return `La nuova password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`;
  }

  if (new TextEncoder().encode(next).length > MAX_PASSWORD_BYTES) {
    return `La nuova password e' troppo lunga (massimo ${MAX_PASSWORD_BYTES} byte, circa ${MAX_PASSWORD_BYTES} caratteri).`;
  }

  if (next === current) {
    return "La nuova password deve essere diversa da quella attuale.";
  }

  if (new Set(next).size < 5) {
    return "La nuova password e' troppo semplice: usa caratteri piu' vari.";
  }

  const lower = next.toLowerCase();
  const letters = lower.replace(/[^a-z]/g, "");

  if (OBVIOUS.has(letters)) {
    return "La nuova password e' troppo comune. Scegline una meno prevedibile.";
  }

  const localPart = (email ?? "").split("@")[0]?.toLowerCase() ?? "";
  if (localPart.length >= 4 && lower.includes(localPart)) {
    return "La nuova password non deve contenere il tuo indirizzo email.";
  }

  return null;
}
