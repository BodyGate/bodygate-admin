export const BODY_ENERGY_BADGE_FEE = 5;

export type BadgeChargeMode = "charged" | "complimentary" | "not_included";

export function normalizeBadgeChargeMode(value: unknown): BadgeChargeMode {
  const mode = String(value || "not_included").trim();
  if (mode === "charged" || mode === "complimentary" || mode === "not_included") return mode;
  return "not_included";
}

export function getDefaultBadgeFee() {
  return {
    name: "Badge RFID",
    price: BODY_ENERGY_BADGE_FEE,
    is_active: true,
  };
}
