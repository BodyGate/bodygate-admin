import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("inventario route Clienti e route manifest restano completi", async () => {
  const expected = [
    "app/customers/page.tsx", "app/customers/new/page.tsx", "app/customers/[id]/page.tsx",
    "app/customers/[id]/edit/page.tsx", "app/customers/[id]/contract/page.tsx",
    "app/customers/[id]/contract/print/page.tsx", "app/customers/[id]/receipt/[receiptId]/page.tsx",
  ]
  await Promise.all(expected.map(path => read(path)))
  const manifest = await read("architecture/route-manifest.mts")
  for (const route of ["/customers", "/customers/new", "/customers/[id]", "/customers/[id]/edit", "/customers/[id]/contract", "/customers/[id]/contract/print", "/customers/[id]/receipt/[receiptId]"]) {
    assert.match(manifest, new RegExp(`path: ${JSON.stringify(route).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
  }
  assert.equal((await readdir(new URL("../app/customers", import.meta.url))).includes("page.tsx"), true)
})

test("le quattro schermate operative usano composizione Platinum reale", async () => {
  const list = await read("app/components/CustomersTable.tsx")
  const create = await read("app/customers/new/page.tsx")
  const detail = await read("app/customers/[id]/CustomerDetailsClient.tsx")
  const editPage = await read("app/customers/[id]/edit/page.tsx")
  const editForm = await read("app/components/CustomerForm.tsx")
  assert.match(list, /adaptCustomerRow/)
  for (const token of ["crm3-filters", "crm3-search", "BGEmptyState", "queryError", "loadCustomers", "crm3-workspace"]) assert.match(list, new RegExp(token))
  for (const token of ["BGPageHeader", "BGInput", "BGSelect", "CustomerDocumentRows", "saving", "Idempotency-Key"]) assert.match(create, new RegExp(token))
  for (const token of ["BGPremiumSectionNav", "BGSectionHeader", "CustomerPaymentsHistory", "CustomerReceiptsHistory", "CustomerTimeline", "CustomerDocumentRows"]) assert.match(detail, new RegExp(token))
  for (const token of ["BGPageShell", "BGPageHeader", "CustomerForm"]) assert.match(editPage, new RegExp(token))
  for (const token of ["BGInput", "BGSelect", "BGButton", "BGAlert", "saving", "router.push"]) assert.match(editForm, new RegExp(token))
})

test("contratti, stampa e ricevuta non ricevono shell o modifiche finanziarie Platinum", async () => {
  const contract = await read("app/customers/[id]/contract/page.tsx")
  const print = await read("app/customers/[id]/contract/print/page.tsx")
  const receipt = await read("app/customers/[id]/receipt/[receiptId]/page.tsx")
  assert.doesNotMatch(print, /BGPageShell|PlatinumAppShell/)
  assert.doesNotMatch(receipt, /BGPageShell|PlatinumAppShell/)
  assert.match(contract, /CustomerContract/)
  assert.match(print, /CustomerContractPrintButton/)
  assert.match(receipt, /window\.print/)
})

test("endpoint, header, payload e side effect Clienti restano invariati", async () => {
  const create = await read("app/customers/new/page.tsx")
  const detail = await read("app/customers/[id]/CustomerDetailsClient.tsx")
  const documents = await read("app/customers/components/CustomerDocumentRows.tsx")
  assert.match(create, /postJson\("\/api\/customers\/create-platinum"/)
  assert.match(create, /"Idempotency-Key": operationId/)
  assert.match(create, /router\.push\(result\.next_url \|\| `\/customers\/\$\{customerId\}\/contract`\)/)
  for (const endpoint of ["update-profile", "renew-membership-fee", "renew-subscription", "update-subscription", "add-note", "add-block", "disable-block"]) assert.match(detail, new RegExp(`/api/customers/${endpoint}`))
  assert.match(documents, /\/api\/customers\/\$\{customerId\}\/medical-certificate`.*method: "PATCH"/s)
  assert.match(documents, /\/api\/customers\/\$\{customerId\}\/documents\/upload`.*method: "POST"/s)
})
