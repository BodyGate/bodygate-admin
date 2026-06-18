export type MedicalCertificateStatus = "missing" | "needs_dates" | "valid" | "expiring_soon" | "expired" | "pending" | "error";

export function todayLocalISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isISODate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function addOneYearISO(value: string) {
  if (!isISODate(value)) return "";
  const [y, m, d] = value.split("-").map(Number);
  const next = new Date(y + 1, m - 1, d);
  if (next.getMonth() !== m - 1) return `${y + 1}-${String(m).padStart(2, "0")}-${String(new Date(y + 1, m, 0).getDate()).padStart(2, "0")}`;
  return todayLocalISO(next);
}

export function addDaysISO(value: string, days: number) {
  if (!isISODate(value)) return "";
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return todayLocalISO(dt);
}

export function diffDaysISO(a: string, b = todayLocalISO()) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime()) / 86400000);
}

export function computeMedicalCertificateStatus(input: { hasFile?: boolean; validFrom?: string | null; validUntil?: string | null; today?: string }): MedicalCertificateStatus {
  if (!input.hasFile) return "missing";
  if (!input.validFrom || !input.validUntil) return "needs_dates";
  if (!isISODate(input.validFrom) || !isISODate(input.validUntil)) return "error";
  const today = input.today || todayLocalISO();
  if (input.validUntil < today) return "expired";
  if (input.validFrom > today) return "pending";
  const left = diffDaysISO(input.validUntil, today);
  if (left <= 30) return "expiring_soon";
  return "valid";
}

export function persistedMedicalCertificateStatus(input: { hasFile?: boolean; validFrom?: string | null; validUntil?: string | null; today?: string }) {
  const status = computeMedicalCertificateStatus(input);
  return status === "expiring_soon" ? "valid" : status;
}

export function formatDateIT(value?: string | null, long = false) {
  if (!value || !isISODate(value)) return "-";
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", long ? { day: "numeric", month: "long", year: "numeric" } : { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(y, m - 1, d));
}

export function humanMedicalTime(validFrom?: string | null, validUntil?: string | null, today = todayLocalISO()) {
  if (!validFrom || !validUntil) return "Date validità mancanti";
  if (!isISODate(validFrom) || !isISODate(validUntil)) return "Date non valide";
  if (validFrom > today) return `Validità futura dal ${formatDateIT(validFrom)}`;
  const days = diffDaysISO(validUntil, today);
  if (days < 0) return `Scaduto da ${Math.abs(days)} giorni`;
  if (days === 0) return "Scade oggi";
  if (days === 1) return "Scade domani";
  return `Scade tra ${days} giorni`;
}
