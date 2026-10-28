import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPassManifest,
  isValidPassToken,
  passManifestPath,
  passManifestResponse,
} from "../app/lib/passManifest.ts";

const TOKEN = "BGM_0VNB-UKBYB6-PB4F";

test("start_url del manifest è la pagina del pass di quel token", () => {
  const manifest = buildPassManifest("mobile", TOKEN);
  assert.equal(manifest.start_url, `/mobile/${TOKEN}`);
  assert.equal(manifest.id, `/mobile/${TOKEN}`);
  assert.equal(buildPassManifest("staff-mobile", "STAFF_abc-12345").start_url, "/staff-mobile/STAFF_abc-12345");
});

test("token diversi danno manifest diversi (nessun token fisso)", () => {
  const a = buildPassManifest("mobile", "AAAAAAAA-1111");
  const b = buildPassManifest("mobile", "BBBBBBBB-2222");
  assert.notEqual(a.start_url, b.start_url);
});

test("il manifest è raggiungibile dal path del pass", () => {
  assert.equal(passManifestPath("mobile", TOKEN), `/mobile/${TOKEN}/manifest.webmanifest`);
});

test("token non validi sono rifiutati", () => {
  assert.equal(isValidPassToken(TOKEN), true);
  assert.equal(isValidPassToken("../admin"), false);
  assert.equal(isValidPassToken("a b c d e f g h"), false);
  assert.equal(isValidPassToken("corto"), false);
  assert.equal(passManifestResponse("mobile", "../../etc").status, 404);
});

test("la risposta ha content-type manifest e non è in cache", async () => {
  const response = passManifestResponse("mobile", TOKEN);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /manifest\+json/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).start_url, `/mobile/${TOKEN}`);
});
