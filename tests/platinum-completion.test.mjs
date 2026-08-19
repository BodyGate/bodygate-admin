import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import test from "node:test"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const routes = [
  "/subscriptions", "/subscriptions/plans", "/settings/pricing", "/payments", "/accounting",
  "/access-control", "/access-control/credentials-audit", "/access-control/debug", "/access-logs", "/badges",
  "/notifications", "/analytics", "/training", "/training/clients", "/training/library",
  "/training/library/[id]", "/training/programs", "/training/programs/[id]", "/training/sessions",
  "/settings", "/settings/permissions", "/system", "/system/audit", "/system/staff", "/login", "/access-denied",
]
const pagePath = route => `app${route === "/" ? "" : route}/page.tsx`

test("l'inventario Platinum completion corrisponde a route e manifest", async () => {
  const manifest = await read("architecture/route-manifest.mts")
  for (const route of routes) {
    await access(new URL(`../${pagePath(route)}`, import.meta.url))
    assert.match(manifest, new RegExp(`path: ["']${route.replaceAll("[", "\\[").replaceAll("]", "\\]")}["']`))
  }
  assert.match(manifest, /path: "\/settings\/modules"[\s\S]*classification: "placeholder"/)
})

test("il runtime migrato usa la facade e resta isolato dal Lab", async () => {
  const sources = await Promise.all(routes.map(route => read(pagePath(route))))
  const runtime = sources.join("\n")
  assert.doesNotMatch(runtime, /components\/bodygate-ui\/(?!index)/)
  assert.doesNotMatch(runtime, /ui-lab\/platinum|preview-content|demo-data/)
})

test("i contratti critici restano riconoscibili e la rateizzazione annuale è isolata", async () => {
  const [shell, payments, accessControl, login] = await Promise.all([
    read("app/components/AppShell.tsx"), read("app/payments/page.tsx"),
    read("app/access-control/page.tsx"), read("app/login/page.tsx"),
  ])
  assert.match(shell, /hasPermission\("view_payments"\)/)
  assert.match(payments, /PaymentsClient/)
  assert.match(accessControl, /BGPageShell/)
  assert.match(login, /LoginForm/)
  assert.doesNotMatch(`${payments}\n${accessControl}`, /annual.{0,40}(three|tre).{0,40}(installment|rat[ae])/i)
})

test("la certificazione documenta stati, rollback e aree protette", async () => {
  const report = await read("docs/platinum-runtime-completion.md")
  for (const term of ["loading", "empty", "error", "retry", "rollback", "route protette", "dato non disponibile"]) {
    assert.match(report.toLowerCase(), new RegExp(term))
  }
})
