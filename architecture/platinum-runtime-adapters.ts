export type DisplayValue = string | number | null

export type DashboardOverviewInput = {
  kpis?: Partial<Record<"active_customers" | "accesses_today" | "denied_today" | "revenue_today" | "revenue_month" | "active_blocks", number | null>> | null
  bridge?: { status?: string | null } | null
  alerts?: Partial<Record<"expired_medical" | "expiring_medical" | "expired_subscriptions" | "expiring_subscriptions", unknown[] | null>> | null
}

const present = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

export function adaptDashboardOverview(input?: DashboardOverviewInput | null) {
  const kpis = input?.kpis
  const alerts = input?.alerts
  return {
    kpis: {
      activeCustomers: present(kpis?.active_customers), accessesToday: present(kpis?.accesses_today),
      deniedToday: present(kpis?.denied_today), revenueToday: present(kpis?.revenue_today),
      revenueMonth: present(kpis?.revenue_month), activeBlocks: present(kpis?.active_blocks),
    },
    bridgeStatus: input?.bridge?.status?.trim() || null,
    alertCounts: {
      expiredMedical: Array.isArray(alerts?.expired_medical) ? alerts.expired_medical.length : null,
      expiringMedical: Array.isArray(alerts?.expiring_medical) ? alerts.expiring_medical.length : null,
      expiredSubscriptions: Array.isArray(alerts?.expired_subscriptions) ? alerts.expired_subscriptions.length : null,
      expiringSubscriptions: Array.isArray(alerts?.expiring_subscriptions) ? alerts.expiring_subscriptions.length : null,
    },
  }
}

export type ReceptionCustomerInput = { id?: string | null; first_name?: string | null; last_name?: string | null; is_active?: boolean | null; medical_certificate_end_date?: string | null; medical_certificate_end?: string | null }
export type ReceptionSubscriptionInput = { customer_id?: string | null; ends_at?: string | null; is_active?: boolean | null }

export function adaptReceptionCustomer(customer?: ReceptionCustomerInput | null, subscriptions: readonly ReceptionSubscriptionInput[] = []) {
  if (!customer?.id) return null
  const name = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
  const subscription = subscriptions.find(item => item.customer_id === customer.id && item.is_active === true)
  return {
    id: customer.id,
    name: name || "Dato non disponibile",
    activeLabel: customer.is_active === true ? "Cliente attivo" : customer.is_active === false ? "Cliente non attivo" : "Da verificare",
    subscriptionExpiry: subscription?.ends_at || null,
    medicalExpiry: customer.medical_certificate_end_date || customer.medical_certificate_end || null,
    membershipFee: null,
  }
}
