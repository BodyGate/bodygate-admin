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
