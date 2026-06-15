export type NormalizedRfidCode = {
  rawCode: string;
  controllerCode: string;
};

const DECIMAL_RE = /^\d+$/;
const HEX_RE = /^[0-9a-f]+$/i;
const DEFAULT_CONTROLLER_WIDTH = 6;

function clean(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function decimalAliases(value: string): string[] {
  if (!DECIMAL_RE.test(value)) return [];

  const withoutLeadingZeroes = value.replace(/^0+/, "") || "0";
  const aliases = [value, withoutLeadingZeroes];

  if (withoutLeadingZeroes.length < DEFAULT_CONTROLLER_WIDTH) {
    aliases.push(withoutLeadingZeroes.padStart(DEFAULT_CONTROLLER_WIDTH, "0"));
  }

  return aliases;
}

export function normalizeRfidCode(value: unknown): NormalizedRfidCode | null {
  const rawCode = clean(value);

  if (!rawCode) return null;

  if (DECIMAL_RE.test(rawCode)) {
    return { rawCode, controllerCode: rawCode.replace(/^0+/, "") || "0" };
  }

  if (!HEX_RE.test(rawCode)) {
    return null;
  }

  const controllerHex = rawCode.slice(-6);
  const controllerCode = Number.parseInt(controllerHex, 16).toString(10);

  return { rawCode, controllerCode };
}

export function credentialLookupCodes(value: unknown): string[] {
  const direct = clean(value);
  const normalized = normalizeRfidCode(direct);
  const aliases = [direct, normalized?.rawCode, normalized?.controllerCode];

  for (const code of [direct, normalized?.rawCode, normalized?.controllerCode]) {
    if (code) aliases.push(...decimalAliases(code));
  }

  return Array.from(new Set(aliases.filter((code): code is string => Boolean(code))));
}

export function rfidLookupCodes(value: unknown): string[] {
  return credentialLookupCodes(value);
}
