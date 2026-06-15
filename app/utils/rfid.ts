export type NormalizedRfidCode = {
  rawCode: string;
  controllerCode: string;
};

const DECIMAL_RE = /^\d+$/;
const HEX_RE = /^[0-9a-f]+$/i;

export function normalizeRfidCode(value: unknown): NormalizedRfidCode | null {
  const rawCode = String(value ?? "").trim().toLowerCase();

  if (!rawCode) return null;

  if (DECIMAL_RE.test(rawCode)) {
    return { rawCode, controllerCode: rawCode };
  }

  if (!HEX_RE.test(rawCode)) {
    return null;
  }

  const controllerHex = rawCode.slice(-6);
  const controllerCode = Number.parseInt(controllerHex, 16).toString(10);

  return { rawCode, controllerCode };
}

export function rfidLookupCodes(value: unknown): string[] {
  const normalized = normalizeRfidCode(value);
  const direct = String(value ?? "").trim().toLowerCase();
  return Array.from(
    new Set(
      [direct, normalized?.rawCode, normalized?.controllerCode].filter(
        (code): code is string => Boolean(code),
      ),
    ),
  );
}
