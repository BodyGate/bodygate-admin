import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import test from "node:test";

const API_ROOT = "app/api";

// Route che NON usano withPermission, con il motivo. Aggiungerne una qui deve
// essere una scelta consapevole e rivista.
const EXEMPT = new Map([
  ["access/check", "hardware: autenticazione macchina (proxy.ts)"],
  ["access/log", "hardware: autenticazione macchina (proxy.ts)"],
  ["dnake/event", "hardware: autenticazione macchina (proxy.ts)"],
  ["bridge/status", "pubblica per il bridge (proxy.ts)"],
  ["health", "health check pubblico"],
  ["auth/login", "login"],
  ["auth/logout", "logout"],
  ["auth/me", "usa requireSession/getCurrentAuthContext"],
  ["admin/test", "route di test senza dati"],
  ["settings/branches", "solo sessione: elenco sedi usato da molte pagine"],
  ["customers/ensure-digital-pass", "usa getCurrentAuthContext in proprio"],
]);

// Singoli handler volutamente accessibili con la sola sessione (lettura di
// listini usata da piu' pagine operative, es. rinnovi in reception).
const HANDLER_EXEMPT = new Set([
  "settings/membership-fee:GET",
  "settings/subscription-plans:GET",
]);

function routeFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });
}

const routes = routeFiles(API_ROOT).map((file) => ({
  file,
  name: relative(API_ROOT, file).split(sep).slice(0, -1).join("/"),
  source: readFileSync(file, "utf8"),
}));

test("every API route is guarded or explicitly exempt", () => {
  const unguarded = routes
    .filter((r) => !r.source.includes("withPermission(") && !EXEMPT.has(r.name))
    .map((r) => r.name);

  assert.deepEqual(
    unguarded,
    [],
    `Route senza withPermission e non in EXEMPT: ${unguarded.join(", ")}`,
  );
});

test("every exported HTTP handler of a guarded route goes through withPermission", () => {
  const offenders = [];

  for (const r of routes) {
    if (!r.source.includes("withPermission(")) continue;
    // Un handler esportato direttamente aggira la guardia.
    for (const m of r.source.matchAll(
      /^export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\(/gm,
    )) {
      const id = `${r.name}:${m[1]}`;
      if (!HANDLER_EXEMPT.has(id)) offenders.push(id);
    }
  }

  assert.deepEqual(offenders, [], `Handler esportati senza guardia: ${offenders.join(", ")}`);
});

test("exempt list has no stale entries", () => {
  const names = new Set(routes.map((r) => r.name));
  const stale = [...EXEMPT.keys()].filter((name) => !names.has(name));
  assert.deepEqual(stale, [], `Eccezioni per route inesistenti: ${stale.join(", ")}`);
});

test("handler exemptions refer to real exported handlers", () => {
  const stale = [...HANDLER_EXEMPT].filter((id) => {
    const [name, method] = id.split(":");
    const route = routes.find((r) => r.name === name);
    return !route || !new RegExp(`^export (?:async )?function ${method}\\(`, "m").test(route.source);
  });
  assert.deepEqual(stale, [], `Eccezioni handler obsolete: ${stale.join(", ")}`);
});
