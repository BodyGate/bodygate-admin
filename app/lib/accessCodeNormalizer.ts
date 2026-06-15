export type NormalizedAccessCode = {
  rawCode: string;
  controllerCode: string | null;
  variants: string[];
  kind: "numeric" | "hex_rfid" | "qr_payload" | "unknown";
  warning: string | null;
};

const DECIMAL_RE = /^\d+$/;
const HEX_RE = /^[0-9a-f]+$/i;

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function clean(input: unknown) {
  return String(input ?? "").trim();
}

export function normalizeNumericControllerCode(input: unknown): string | null {
  const raw = clean(input);
  if (!raw || !DECIMAL_RE.test(raw)) return null;
  return raw.replace(/^0+/, "") || "0";
}

export function deriveControllerCodeFromRawBadge(input: unknown): string | null {
  const raw = clean(input).toLowerCase();
  if (!raw) return null;
  if (DECIMAL_RE.test(raw)) return normalizeNumericControllerCode(raw);
  if (!HEX_RE.test(raw)) return null;
  if (raw.length < 6) return null;

  const controllerHex = raw.slice(-6);
  return Number.parseInt(controllerHex, 16).toString(10);
}

export function getAccessCodeVariants(input: unknown): string[] {
  const normalized = normalizeAccessCode(input);
  return normalized.variants;
}

export function getAccessCodeLookupVariants(...inputs: unknown[]): string[] {
  const variants: string[] = [];
  for (const input of inputs) {
    const normalized = normalizeAccessCode(input);
    variants.push(...normalized.variants);
  }
  return unique(variants);
}

export function normalizeAccessCode(input: unknown): NormalizedAccessCode {
  const trimmed = clean(input);

  if (!trimmed) {
    return {
      rawCode: "",
      controllerCode: null,
      variants: [],
      kind: "unknown",
      warning: "Codice mancante.",
    };
  }

  if (DECIMAL_RE.test(trimmed)) {
    const controllerCode = normalizeNumericControllerCode(trimmed);
    return {
      rawCode: trimmed,
      controllerCode,
      variants: unique([trimmed, controllerCode]),
      kind: "numeric",
      warning: null,
    };
  }

  if (trimmed.toLowerCase().startsWith("local_user=")) {
    return {
      rawCode: trimmed,
      controllerCode: null,
      variants: [trimmed],
      kind: "qr_payload",
      warning: "Payload QR mantenuto come codice grezzo: normalizzare il controller_code DNake separato.",
    };
  }

  const rawCode = trimmed.toLowerCase();
  if (HEX_RE.test(rawCode) && rawCode.length >= 6) {
    const controllerCode = deriveControllerCodeFromRawBadge(rawCode);
    return {
      rawCode,
      controllerCode,
      variants: unique([rawCode, controllerCode]),
      kind: "hex_rfid",
      warning: null,
    };
  }

  return {
    rawCode: trimmed,
    controllerCode: null,
    variants: [trimmed],
    kind: "unknown",
    warning: "Codice bridge non derivabile in modo sicuro.",
  };
}
