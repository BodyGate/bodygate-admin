export class DnakeUserDirectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DnakeUserDirectoryError";
  }
}

// The 170AC.2.0.16 panel stores a user id as a number ("000033" becomes "33"),
// while the QR it validates may still carry the padded form, so ids are only
// ever compared without leading zeros.
export function normalizeDnakeUserId(id: string) {
  const digits = id.trim();
  return /^\d+$/.test(digits) ? digits.replace(/^0+(?=\d)/, "") : digits;
}

// The panel refuses (silently) a user whose name already exists in its local or
// cloud list, e.g. a customer with the same name as the cloud resident. The id
// is appended so every customer gets a distinct panel name; the 26 characters
// limit of the panel is kept.
export function dnakePanelUserName(baseName: string, dnakeUserId: string) {
  const suffix = ` ${normalizeDnakeUserId(dnakeUserId)}`;
  const base = baseName.trim() || "BodyGate User";
  return `${base.slice(0, Math.max(1, 26 - suffix.length)).trimEnd()}${suffix}`;
}

function parseCsvFirstField(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const firstComma = trimmed.indexOf(",");
  const rawField = firstComma >= 0 ? trimmed.slice(0, firstComma) : trimmed;
  return rawField.trim().replace(/^"|"$/g, "");
}

export function dnakeDirectoryContainsUserId(content: string, dnakeUserId: string) {
  const normalized = content.replace(/^\uFEFF/, "").trim();

  if (!normalized) {
    throw new DnakeUserDirectoryError("Il file utenti DNake è vuoto.");
  }

  const lines = normalized.split(/\r?\n/);
  const csvLines = lines.filter((line) => /^\s*"?\d+"?\s*,/.test(line));

  if (csvLines.length > 0) {
    const wanted = normalizeDnakeUserId(dnakeUserId);
    return csvLines.some((line) => normalizeDnakeUserId(parseCsvFirstField(line) ?? "") === wanted);
  }

  if (normalized.startsWith("<")) {
    const escaped = dnakeUserId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\D)${escaped}(\\D|$)`, "m").test(normalized);
  }

  throw new DnakeUserDirectoryError(
    "Formato del file utenti DNake non riconosciuto: atteso CSV o XML.",
  );
}

export function isDnakeDirectoryEmpty(content: string) {
  return !content.replace(/^\uFEFF/, "").trim();
}

// Firmware 170AC.Cloud keeps local users in /data/users.xml, which is a
// zero-byte file when the panel has no local users (cloud users live in
// users_cloud.xml). The file alone cannot tell "no users" from a failed read,
// so an empty file only counts as "no users" when the panel's own user count
// (api=user -> local_cnt) agrees.
export function dnakeLocalUserCount(apiUserResponse: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(apiUserResponse);
  } catch {
    throw new DnakeUserDirectoryError("Risposta api=user del DNake non valida.");
  }

  const raw = (parsed as { local_cnt?: unknown } | null)?.local_cnt;
  const count = Number(raw);
  if (raw === undefined || raw === null || raw === "" || !Number.isInteger(count) || count < 0) {
    throw new DnakeUserDirectoryError("Conteggio utenti locali DNake non disponibile.");
  }

  return count;
}
