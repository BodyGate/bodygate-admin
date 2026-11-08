export type PasswordStore = {
  getHash(userId: string): Promise<string | null>;
  setHash(userId: string, hash: string): Promise<void>;
  audit(event: { userId: string; email: string }): Promise<void>;
};

export type PasswordCrypto = {
  compare(plain: string, hash: string): Promise<boolean>;
  hash(plain: string): Promise<string>;
};

export type PasswordValidator = (input: {
  current: string;
  next: string;
  email?: string;
}) => string | null;

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; status: 400 | 500; error: string };

/**
 * Logica del cambio password, senza Next ne' database: testabile con un
 * archivio finto (tests/changePassword.test.mjs).
 */
export async function changePassword(
  deps: { store: PasswordStore; crypto: PasswordCrypto; validate: PasswordValidator },
  input: { userId: string; email: string; current: string; next: string },
): Promise<ChangePasswordResult> {
  const { store, crypto, validate } = deps;
  const { userId, email, current, next } = input;

  if (!current || !next) {
    return { ok: false, status: 400, error: "Password attuale e nuova password sono obbligatorie." };
  }

  const policyError = validate({ current, next, email });
  if (policyError) return { ok: false, status: 400, error: policyError };

  const storedHash = await store.getHash(userId);
  if (!storedHash) return { ok: false, status: 500, error: "Utente non trovato." };

  if (!(await crypto.compare(current, storedHash))) {
    return { ok: false, status: 400, error: "La password attuale non e' corretta." };
  }

  await store.setHash(userId, await crypto.hash(next));

  // La traccia dell'evento non deve annullare un cambio gia' riuscito.
  try {
    await store.audit({ userId, email });
  } catch {
    /* ignorato di proposito */
  }

  return { ok: true };
}
