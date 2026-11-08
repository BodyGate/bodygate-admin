/**
 * Decisione di autorizzazione lato server, senza dipendenze da Next o dal
 * database cosi' da poterla testare in isolamento.
 *
 * Regola: un amministratore passa sempre; gli altri devono avere TUTTI i
 * permessi richiesti. Se non viene richiesto alcun permesso, serve comunque
 * una sessione valida (verificata a monte).
 */
export type PermissionSubject = {
  isAdmin: boolean;
  permissions: readonly string[];
};

export function canAccess(
  subject: PermissionSubject,
  required: readonly string[],
): boolean {
  if (subject.isAdmin) return true;
  if (required.length === 0) return true;

  const granted = new Set(subject.permissions);
  return required.every((permission) => granted.has(permission));
}
