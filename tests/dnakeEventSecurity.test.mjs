import assert from "node:assert/strict";
import test from "node:test";

import {
  createBadgeDeduper,
  isValidDnakeEventKey,
  redactSensitive,
} from "../app/lib/server/dnakeEventSecurity.ts";

test("chiave evento: vale solo se uguale e configurata", () => {
  assert.equal(isValidDnakeEventKey("abc123", "abc123"), true);
  assert.equal(isValidDnakeEventKey(" abc123 ", "abc123"), true);
  assert.equal(isValidDnakeEventKey("abc124", "abc123"), false);
  assert.equal(isValidDnakeEventKey("abc", "abc123"), false);
  assert.equal(isValidDnakeEventKey(null, "abc123"), false);
  assert.equal(isValidDnakeEventKey("abc123", ""), false);
  assert.equal(isValidDnakeEventKey("abc123", undefined), false);
  assert.equal(isValidDnakeEventKey("", ""), false);
});

test("i segreti non finiscono nei log", () => {
  const out = redactSensitive({
    code: "123456",
    dnake_key: "segreto",
    headers: { "x-bodygate-machine-key": "k", host: "h", Cookie: "c" },
    list: [{ password: "p", n: 1 }],
  });

  assert.equal(out.code, "123456");
  assert.equal(out.dnake_key, "[nascosto]");
  assert.equal(out.headers["x-bodygate-machine-key"], "[nascosto]");
  assert.equal(out.headers.Cookie, "[nascosto]");
  assert.equal(out.headers.host, "h");
  assert.deepEqual(out.list, [{ password: "[nascosto]", n: 1 }]);
  assert.equal(redactSensitive("testo"), "testo");
  assert.equal(redactSensitive(null), null);
});

test("anti-doppione: stesso badge entro la finestra, altro badge no", () => {
  const isDuplicate = createBadgeDeduper(3000);

  assert.equal(isDuplicate("A", 1000), false);
  assert.equal(isDuplicate("A", 2500), true);
  assert.equal(isDuplicate("B", 2500), false);
  assert.equal(isDuplicate("A", 4000), false);
  assert.equal(isDuplicate("A", 4001), true);
});

test("anti-doppione: la mappa non cresce senza limite", () => {
  const isDuplicate = createBadgeDeduper(10, 5);

  for (let i = 0; i < 50; i++) {
    isDuplicate(`badge-${i}`, i * 100);
  }

  assert.equal(isDuplicate("badge-49", 4905), true);
});
