// Pure decision logic for whether a customer may enter, extracted from
// app/api/access/check/route.ts so the actual gym-access rules (the part
// with real physical and legal consequences if wrong) can be unit tested
// without mocking Supabase. Mirrors the route's existing check order
// exactly - do not reorder without re-checking tests/accessEligibility.test.mjs.

export type CustomerRecord = {
  is_active?: boolean | null;
  branch_id?: string | null;
  medical_certificate_start_date?: string | null;
  medical_certificate_start?: string | null;
  medical_certificate_end_date?: string | null;
  medical_certificate_end?: string | null;
  medical_certificate_status?: string | null;
};

export type ActiveBlock = { reason?: string | null } | null | undefined;

export type MembershipSetting = { required_for_access?: boolean | null } | null | undefined;

export type ValidMembershipFee = Record<string, unknown> | null | undefined;

export type ValidSubscription = Record<string, unknown> | null | undefined;

export type EligibilityResult =
  | { allowed: true; reason: "Accesso consentito" }
  | { allowed: false; reason: string };

export function evaluateAccessEligibility(params: {
  customer: CustomerRecord;
  today: string;
  activeBlock: ActiveBlock;
  membershipSetting: MembershipSetting;
  validMembershipFee: ValidMembershipFee;
  validSubscription: ValidSubscription;
}): EligibilityResult {
  const {
    customer,
    today,
    activeBlock,
    membershipSetting,
    validMembershipFee,
    validSubscription,
  } = params;

  if (!customer.branch_id) {
    return { allowed: false, reason: "Cliente non associato a nessuna sede" };
  }

  if (activeBlock) {
    return {
      allowed: false,
      reason: `Accesso bloccato: ${activeBlock.reason}`,
    };
  }

  const medicalCertificateStart =
    customer.medical_certificate_start_date || customer.medical_certificate_start;
  const medicalCertificateEnd =
    customer.medical_certificate_end_date || customer.medical_certificate_end;
  const medicalCertificateStatus = String(
    customer.medical_certificate_status || ""
  ).toLowerCase();

  if (
    !medicalCertificateStart ||
    !medicalCertificateEnd ||
    medicalCertificateStart > today ||
    medicalCertificateEnd < today ||
    medicalCertificateStatus === "expired"
  ) {
    return {
      allowed: false,
      reason: "Certificato medico scaduto o mancante",
    };
  }

  if (membershipSetting?.required_for_access && !validMembershipFee) {
    return {
      allowed: false,
      reason: "Quota associativa assente o scaduta",
    };
  }

  if (!validSubscription) {
    return { allowed: false, reason: "Abbonamento assente o scaduto" };
  }

  return { allowed: true, reason: "Accesso consentito" };
}
