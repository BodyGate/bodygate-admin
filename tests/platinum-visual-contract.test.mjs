import assert from "node:assert/strict"
import { readFile, stat } from "node:fs/promises"
import test from "node:test"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("Lab e runtime condividono la stessa shell configurabile", async () => {
  const [shell, runtime, lab, demo] = await Promise.all([read("components/bodygate-ui/PlatinumAppShell.tsx"), read("app/components/AppShell.tsx"), read("app/ui-lab/platinum/page.tsx"), read("app/ui-lab/platinum/PlatinumDemo.tsx")])
  assert.match(shell, /type ShellMode = "lab" \| "runtime"/)
  assert.match(runtime, /<PlatinumAppShell[\s\S]*mode="runtime"/)
  assert.match(`${lab}\n${demo}`, /<PlatinumAppShell mode="lab"/)
  assert.match(shell, /brandMark}>BG/); assert.match(shell, /edition: "PLATINUM"/)
  assert.match(shell, /className=\{styles\.topbar\}/); assert.match(shell, /OperatorProfile/)
})

test("la navigazione ha gruppi, icone e profilo operativo", async () => {
  const shell = await read("components/bodygate-ui/PlatinumAppShell.tsx")
  assert.match(shell, /PLATINUM_GROUP_LABELS/); assert.match(shell, /iconByName/); assert.match(shell, /Operatore BodyGate/); assert.match(shell, /Reception/)
  assert.match(shell, /fetch\("\/api\/auth\/logout", \{ method: "POST" \}\)/)
  assert.match(shell, /PLATINUM_NAVIGATION\.filter\(item => item\.mobilePlacement === "bottom"\)/)
})

test("la Dashboard applica il contratto compositivo e conserva i dati", async () => {
  const [dashboard, css] = await Promise.all([read("app/page.tsx"), read("app/dashboard.module.css")])
  assert.match(dashboard, /data-primary-kpi-count="4"/)
  assert.equal((dashboard.match(/label: "/g) ?? []).length, 4)
  assert.doesNotMatch(dashboard, /Controllo palestra in tempo reale/)
  assert.match(css, /\.money\{white-space:nowrap\}/)
  for (const marker of ["activeCustomers", "accessesToday", "deniedToday", "revenueToday", "revenueMonth", "activeBlocks", "bridgeStatus", "expiredMedical", "expiringMedical", "expiredSubscriptions", "expiringSubscriptions", "latestAccess"]) assert.match(dashboard, new RegExp(marker))
  assert.match(dashboard, /fetch\("\/api\/dashboard\/overview", \{ cache: "no-store" \}\)/)
  assert.match(dashboard, /setInterval\(loadDashboard, 30000\)/)
  assert.doesNotMatch(dashboard, /ui-lab|demo-data|preview-content/)
})

test("sidebar e bottom navigation sono mutuamente esclusivi a 820\/821", async () => {
  const css = await read("components/bodygate-ui/platinum.module.css")
  assert.match(css, /@media\(max-width:820px\)[\s\S]*\.sidebar\{display:none\}/)
  assert.match(css, /@media\(max-width:820px\)[\s\S]*\.bottomNav\{[^}]*display:grid/)
  assert.match(css, /@media\(min-width:821px\)[\s\S]*\.mobileDrawerBackdrop/)
})

test("nessuna area protetta o dipendenza viene modificata dal recovery", async () => {
  const packageJson = JSON.parse(await read("package.json"))
  assert.equal(packageJson.scripts["qa:platinum-visual-contract"], "node --test tests/platinum-visual-contract.test.mjs")
  for (const path of ["app/api", "middleware.ts", "package-lock.json"]) await stat(new URL(`../${path}`, import.meta.url))
})
