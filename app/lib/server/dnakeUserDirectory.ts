export class DnakeUserDirectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DnakeUserDirectoryError";
  }
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
    return csvLines.some((line) => parseCsvFirstField(line) === dnakeUserId);
  }

  if (normalized.startsWith("<")) {
    const escaped = dnakeUserId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\D)${escaped}(\\D|$)`, "m").test(normalized);
  }

  throw new DnakeUserDirectoryError(
    "Formato del file utenti DNake non riconosciuto: atteso CSV o XML.",
  );
}
