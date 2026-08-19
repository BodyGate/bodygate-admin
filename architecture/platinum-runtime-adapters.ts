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

export type CustomerRuntimeInput = {
  id?: string | null; first_name?: string | null; last_name?: string | null; full_name?: string | null
  email?: string | null; phone?: string | null; active?: boolean | null; is_active?: boolean | null
  badge_code?: string | null; controller_code?: string | null; subscription_status?: string | null
  subscription_expiry?: string | null; medical_certificate_status?: string | null
  medical_certificate_end_date?: string | null; medical_certificate_end?: string | null
}

export type CustomerDocumentInput = {
  id?: string | null; document_type?: string | null; file_url?: string | null; public_url?: string | null
  status?: string | null; valid_from?: string | null; valid_until?: string | null; created_at?: string | null
}

export type CustomerAccessInput = { id?: string | null; created_at?: string | null; result?: string | null; direction?: string | null; reader_name?: string | null }
export type CustomerPaymentInput = { id?: string | null; amount?: number | null; status?: string | null; payment_method?: string | null; paid_at?: string | null; created_at?: string | null }
export type CustomerReceiptInput = { id?: string | null; receipt_number?: string | null; amount?: number | null; issued_at?: string | null; created_at?: string | null; payment_id?: string | null }
export type CustomerTimelineInput = { id?: string | null; title?: string | null; detail?: string | null; type?: string | null; created_at?: string | null }

const clean = (value: string | null | undefined) => value?.trim() || null
const statusLabel = (value: string | null | undefined, fallback = "Da verificare") => clean(value) || fallback

/** Pure view models. IDs and raw action values are deliberately retained. */
export function adaptCustomerRow(customer?: CustomerRuntimeInput | null) {
  if (!customer?.id) return null
  const name = clean(customer.full_name) || [clean(customer.first_name), clean(customer.last_name)].filter(Boolean).join(" ") || null
  return {
    id: customer.id, name: name || "Non disponibile", email: clean(customer.email), phone: clean(customer.phone),
    badgeCode: clean(customer.badge_code) || clean(customer.controller_code), active: customer.active ?? customer.is_active ?? null,
    subscriptionStatus: statusLabel(customer.subscription_status), subscriptionExpiry: clean(customer.subscription_expiry),
    medicalStatus: statusLabel(customer.medical_certificate_status),
    medicalExpiry: clean(customer.medical_certificate_end_date) || clean(customer.medical_certificate_end),
  }
}

export function adaptCustomerIdentity(customer?: CustomerRuntimeInput | null) {
  const row = adaptCustomerRow(customer)
  if (!row) return null
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, badgeCode: row.badgeCode }
}

export function adaptCustomerStatus(customer?: CustomerRuntimeInput | null) {
  if (!customer?.id) return null
  const active = customer.active ?? customer.is_active ?? null
  return { id: customer.id, value: active, label: active === true ? "Cliente attivo" : active === false ? "Cliente non attivo" : "Da verificare" }
}

export function adaptSubscriptionStatus(customer?: CustomerRuntimeInput | null) {
  if (!customer?.id) return null
  return { customerId: customer.id, status: statusLabel(customer.subscription_status, "Non registrato"), expiresAt: clean(customer.subscription_expiry) }
}

export function adaptMembershipFee(input?: { id?: string | null; status?: string | null; amount?: number | null; valid_until?: string | null; customer_id?: string | null } | null) {
  if (!input) return null
  return { id: clean(input.id), customerId: clean(input.customer_id), status: statusLabel(input.status, "Non registrata"), amount: present(input.amount), validUntil: clean(input.valid_until) }
}

export function adaptMedicalCertificate(customer?: CustomerRuntimeInput | null) {
  if (!customer?.id) return null
  return { customerId: customer.id, status: statusLabel(customer.medical_certificate_status, "Non registrato"), expiresAt: clean(customer.medical_certificate_end_date) || clean(customer.medical_certificate_end) }
}

export function adaptCustomerDocument(input?: CustomerDocumentInput | null) {
  if (!input) return null
  return { id: clean(input.id), type: statusLabel(input.document_type, "Documento"), status: statusLabel(input.status), url: clean(input.file_url) || clean(input.public_url), validFrom: clean(input.valid_from), validUntil: clean(input.valid_until), createdAt: clean(input.created_at) }
}

export function adaptRecentAccess(input?: CustomerAccessInput | null) {
  if (!input) return null
  return { id: clean(input.id), occurredAt: clean(input.created_at), result: statusLabel(input.result), direction: clean(input.direction), readerName: clean(input.reader_name) }
}

export function adaptDisplayedPayment(input?: CustomerPaymentInput | null) {
  if (!input) return null
  return { id: clean(input.id), amount: present(input.amount), status: statusLabel(input.status), method: clean(input.payment_method), paidAt: clean(input.paid_at), createdAt: clean(input.created_at) }
}

export function adaptDisplayedReceipt(input?: CustomerReceiptInput | null) {
  if (!input) return null
  return { id: clean(input.id), paymentId: clean(input.payment_id), number: clean(input.receipt_number), amount: present(input.amount), issuedAt: clean(input.issued_at) || clean(input.created_at) }
}

export function adaptCustomerTimelineItem(input?: CustomerTimelineInput | null) {
  if (!input) return null
  return { id: clean(input.id), title: statusLabel(input.title, "Attività cliente"), detail: clean(input.detail), type: clean(input.type), occurredAt: clean(input.created_at) }
}
