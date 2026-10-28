// "Accesso attivo" nella lista clienti = il cliente oggi entrerebbe davvero.
// Regola di prodotto: servono TUTTI e tre i requisiti (quota associativa,
// abbonamento, certificato medico in corso di validità); se ne manca uno il
// cliente non è attivo e non entra. Si riusa evaluateAccessEligibility, la
// stessa funzione di /api/access/check (passata dal chiamante, così il file non
// ha import runtime e resta eseguibile dai test), con la quota sempre obbligatoria.

import type { CustomerRecord, evaluateAccessEligibility } from "./accessEligibility";

export type AccessReadyContext = {
  today: string;
  // chiavi "customerId|branchId" con quota associativa valida oggi
  feeKeys: Set<string>;
  // customer_id con abbonamento attivo valido oggi
  subscriptionCustomerIds: Set<string>;
  // customer_id con blocco attivo
  blockedCustomerIds: Set<string>;
};

export function feeKey(customerId: string, branchId: string) {
  return `${customerId}|${branchId}`;
}

export function isAccessReady(
  evaluate: typeof evaluateAccessEligibility,
  customer: CustomerRecord & { id: string },
  ctx: AccessReadyContext
): boolean {
  const branchId = customer.branch_id || "";

  return evaluate({
    customer,
    today: ctx.today,
    activeBlock: ctx.blockedCustomerIds.has(customer.id)
      ? { reason: "blocco attivo" }
      : null,
    membershipSetting: { required_for_access: true },
    validMembershipFee: ctx.feeKeys.has(feeKey(customer.id, branchId))
      ? { id: "fee" }
      : null,
    validSubscription: ctx.subscriptionCustomerIds.has(customer.id)
      ? { id: "subscription" }
      : null,
  }).allowed;
}
