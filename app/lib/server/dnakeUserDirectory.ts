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

export function isDnakeDirectoryEmpty(content: string) {
  return !content.replace(/^﻿/, "").trim();
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
