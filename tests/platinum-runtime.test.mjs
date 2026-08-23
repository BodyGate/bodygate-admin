import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")

async function loadAdapters() {
  const source = await read("architecture/platinum-runtime-adapters.ts")
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  Function("module", "exports", js)(loaded, loaded.exports)
  return { source, ...loaded.exports }
}

test("gli adapter sono puramente presentazionali e gestiscono dati mancanti", async () => {
  const { source, adaptDashboardOverview, adaptReceptionCustomer } = await loadAdapters()
  assert.doesNotMatch(source, /fetch\s*\(|supabase|\.from\s*\(|insert|update|delete/)
  const dashboard = adaptDashboardOverview({ kpis: { accesses_today: 0 } })
  assert.equal(dashboard.kpis.accessesToday, 0)
  assert.equal(dashboard.kpis.revenueToday, null)
  assert.equal(dashboard.alertCounts.expiredMedical, null)
  assert.equal(adaptReceptionCustomer(undefined), null)
  assert.equal(adaptReceptionCustomer({ id: "1" }).name, "Dato non disponibile")
})

test("il runtime conserva endpoint, metodi e side effect operativi", async () => {
  const dashboard = await read("app/page.tsx")
  const reception = await read("app/components/ReceptionDashboard.tsx")
  assert.match(dashboard, /fetch\("\/api\/dashboard\/overview", \{ cache: "no-store" \}\)/)
  assert.match(dashboard, /setInterval\(loadDashboard, 30000\)/)
  assert.match(reception, /fetch\("\/api\/bridge\/status", \{ cache: "no-store" \}\)/)
  assert.match(reception, /window\.setInterval[\s\S]*5000/)
  assert.doesNotMatch(`${dashboard}\n${reception}`, /preview-content|ui-lab\/platinum/)
  assert.doesNotMatch(`${dashboard}\n${reception}`, /method:\s*["'](?:POST|PUT|PATCH|DELETE)/)
  assert.match(dashboard, /totalAlerts === null \? "Da verificare"/)
  assert.match(dashboard, /latestAccess === null/)
})

test("le pagine operative usano esclusivamente la facade BodyGate UI", async () => {
  for (const path of ["app/page.tsx", "app/reception/page.tsx", "app/components/ReceptionDashboard.tsx"]) {
    const source = await read(path)
    assert.doesNotMatch(source, /components\/bodygate-ui\/(?!index)/)
    assert.doesNotMatch(source, /app\/ui-lab|ui-lab\/platinum/)
  }
})

test("la shell preserva logout e permesso Incassi senza dipendere dal Lab", async () => {
  const appShell = await read("app/components/AppShell.tsx")
  const platinumShell = await read("components/bodygate-ui/PlatinumAppShell.tsx")
  assert.match(appShell, /hasPermission\("view_payments"\)/)
  assert.match(platinumShell, /paymentsAccess === "denied"/)
  assert.match(platinumShell, /fetch\("\/api\/auth\/logout", \{ method: "POST" \}\)/)
  assert.doesNotMatch(`${appShell}\n${platinumShell}`, /preview-content/)
})

test("gli adapter Clienti preservano identificativi e valori reali senza inventare fallback economici", async () => {
  const adapters = await loadAdapters()
  const row = adapters.adaptCustomerRow({ id: "customer-1", first_name: " Ada ", last_name: "Lovelace", active: true, subscription_expiry: null })
  assert.deepEqual(row.name, "Ada Lovelace")
  assert.equal(row.id, "customer-1")
  assert.equal(row.subscriptionExpiry, null)
  assert.equal(adapters.adaptCustomerRow({ first_name: "Senza id" }), null)
  assert.equal(adapters.adaptMembershipFee({ id: "fee-1", amount: 0 }).amount, 0)
  assert.equal(adapters.adaptMembershipFee({ id: "fee-2" }).amount, null)
  assert.equal(adapters.adaptDisplayedPayment({ id: "pay-1", amount: 12.5 }).id, "pay-1")
  assert.equal(adapters.adaptDisplayedReceipt({ id: "receipt-1", payment_id: "pay-1" }).paymentId, "pay-1")
  assert.equal(adapters.adaptCustomerDocument({ id: "doc-1" }).url, null)
  assert.equal(adapters.adaptRecentAccess({ id: "access-1" }).occurredAt, null)
  assert.equal(adapters.adaptCustomerTimelineItem({ id: "event-1" }).detail, null)
})

test("il modulo Clienti usa la facade e conserva i contratti operativi", async () => {
  const paths = [
    "app/customers/page.tsx", "app/customers/new/page.tsx", "app/customers/[id]/page.tsx",
    "app/customers/[id]/edit/page.tsx", "app/components/CustomersTable.tsx",
    "app/customers/[id]/CustomerDetailsClient.tsx", "app/customers/components/CustomerReceiptsHistory.tsx",
  ]
  const sources = await Promise.all(paths.map(read))
  const joined = sources.join("\n")
  assert.doesNotMatch(joined, /components\/bodygate-ui\/(?!index)/)
  assert.doesNotMatch(joined, /preview-content|app\/ui-lab|ui-lab\/platinum/)
  assert.match(joined, /\/api\/customers\/list\?status=/)
  assert.match(joined, /postJson\("\/api\/customers\/create-platinum"/)
  assert.match(joined, /"Idempotency-Key": operationId/)
  assert.match(joined, /\/api\/customers\/update-profile/)
  assert.match(joined, /\/api\/customers\/renew-membership-fee/)
  assert.match(joined, /\/api\/customers\/renew-subscription/)
  assert.match(joined, /\/api\/customers\/update-subscription/)
})
