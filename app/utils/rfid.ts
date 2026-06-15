export {
  deriveControllerCodeFromRawBadge,
  getAccessCodeLookupVariants as credentialLookupCodes,
  getAccessCodeLookupVariants as rfidLookupCodes,
  getAccessCodeVariants,
  normalizeAccessCode,
} from "../lib/accessCodeNormalizer";

import { normalizeAccessCode } from "../lib/accessCodeNormalizer";

export type NormalizedRfidCode = {
  rawCode: string;
  controllerCode: string;
};

export function normalizeRfidCode(value: unknown): NormalizedRfidCode | null {
  const normalized = normalizeAccessCode(value);
  if (!normalized.rawCode || !normalized.controllerCode) return null;
  return {
    rawCode: normalized.rawCode,
    controllerCode: normalized.controllerCode,
  };
}
