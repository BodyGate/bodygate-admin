import assert from "node:assert/strict"
import test from "node:test"

import { PLATINUM_GROUPS, PLATINUM_NAVIGATION, navigationForRole } from "../architecture/platinum-navigation.ts"
import { ROUTE_MANIFEST } from "../architecture/route-manifest.mts"

const flatten = (items) => items.flatMap((item) => [item, ...flatten(item.children)])
const allItems = flatten(PLATINUM_NAVIGATION)
const manifestByPath = new Map(ROUTE_MANIFEST.map((route) => [route.path, route]))

test("navigation IDs and hrefs are unique and governed", () => {
  assert.equal(new Set(allItems.map((item) => item.id)).size, allItems.length, "navigation IDs must be unique")
  assert.equal(new Set(allItems.map((item) => item.href)).size, allItems.length, "navigation hrefs must not be duplicated")
  for (const item of allItems) assert.ok(manifestByPath.has(item.href), `${item.href} is absent from the route manifest`)
})

test("ordinary navigation excludes non-operational route classifications", () => {
  const forbidden = new Set(["lab", "prototype", "technical", "placeholder", "legacy-redirect", "public", "contextual"])
  const ordinaryItems = flatten(navigationForRole("reception"))
  for (const item of ordinaryItems) assert.equal(forbidden.has(manifestByPath.get(item.href).classification), false, `${item.href} is not an ordinary route`)
})

test("desktop and mobile derive from one complete configuration", () => {
  const desktop = PLATINUM_NAVIGATION.filter((item) => item.desktopPlacement === "primary")
  const mobile = PLATINUM_NAVIGATION.filter((item) => item.mobilePlacement === "bottom" || item.mobilePlacement === "more")
  assert.deepEqual(mobile.map((item) => item.id).sort(), desktop.map((item) => item.id).sort())
  assert.ok(PLATINUM_NAVIGATION.filter((item) => item.mobilePlacement === "bottom").length <= 4, "four configured entries plus Altro must fit the five-item bottom navigation")
})

test("required groups and labels are represented without duplicates", () => {
  assert.deepEqual([...new Set(PLATINUM_NAVIGATION.map((item) => item.group))], [...PLATINUM_GROUPS])
  const expected = ["Dashboard", "Reception", "Clienti", "Accessi", "Incassi", "Abbonamenti", "Scadenze e notifiche", "Training", "Report", "Contabilità", "Staff", "Configurazione", "Sistema"]
  assert.deepEqual(PLATINUM_NAVIGATION.map((item) => item.label), expected)
})

test("administrative and privileged entries declare access metadata", () => {
  const privileged = allItems.filter((item) => item.group === "administration" || item.roles.length === 1)
  assert.ok(privileged.length > 0)
  for (const item of privileged) {
    assert.ok(item.permission.length > 0, `${item.id} requires a permission declaration`)
    assert.deepEqual(item.roles, ["administrator"], `${item.id} must be limited to administrators`)
  }
})

test("Accessi contains the required role-aware submenu", () => {
  const access = PLATINUM_NAVIGATION.find((item) => item.id === "access-control")
  assert.deepEqual(access.children.map((item) => item.label), ["Registro ingressi", "Credenziali", "Debug Center", "Audit credenziali"])
  assert.deepEqual(navigationForRole("reception").find((item) => item.id === "access-control").children.map((item) => item.label), ["Registro ingressi", "Credenziali"])
})
