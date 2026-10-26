import assert from "node:assert/strict";
import test from "node:test";

import {
  DNAKE_DB_DEFAULT_LIMIT_BYTES,
  evaluateBridgeHealth,
} from "../app/lib/server/bridgeHealth.ts";

test("bridge irraggiungibile o vecchio senza campi nuovi: nessun allarme inventato", () => {
  assert.equal(evaluateBridgeHealth(null).level, "ok");
  assert.equal(evaluateBridgeHealth(undefined).level, "ok");

  const old = evaluateBridgeHealth({ ok: true, version: "V3.9.3" });
  assert.equal(old.level, "ok");
  assert.equal(old.polling_healthy, null);
  assert.equal(old.db, null);
});

test("il caso del 9 ottobre: risponde ma non legge i badge -> critico", () => {
  const health = evaluateBridgeHealth({
    ok: true,
    pollHealthy: false,
    consecutivePollFailures: 309,
    dnakeDbExpectedBytes: 318464,
    dnakeDbReceivedBytes: 290816,
    lastPollError: "DnakeDbIncompleteException: ricevuti 290816 byte su 318464",
  });

  assert.equal(health.level, "critical");
  assert.equal(health.polling_healthy, false);
  assert.deepEqual(health.reasons, ["polling_down"]);
  assert.match(health.message, /non riesce a leggere i badge/);
  assert.match(health.message, /290816/);
  assert.equal(health.db.percent_of_limit, 110);
});

test("l'errore lungo viene accorciato nel messaggio", () => {
  const health = evaluateBridgeHealth({
    pollHealthy: false,
    lastPollError: "x".repeat(500),
  });

  assert.ok(health.message.length < 400);
  assert.match(health.message, /\.\.\.$/);
});

test("sano e database piccolo -> ok con percentuale", () => {
  const health = evaluateBridgeHealth({
    pollHealthy: true,
    dnakeDbPartial: false,
    dnakeDbExpectedBytes: 29081,
  });

  assert.equal(health.level, "ok");
  assert.equal(health.message, null);
  assert.equal(health.db.percent_of_limit, 10);
  assert.equal(health.db.limit_bytes, DNAKE_DB_DEFAULT_LIMIT_BYTES);
});

test("preavviso: database al 70% del limite -> warning prima del blocco", () => {
  const justBelow = evaluateBridgeHealth({
    pollHealthy: true,
    dnakeDbExpectedBytes: Math.floor(DNAKE_DB_DEFAULT_LIMIT_BYTES * 0.69),
  });
  assert.equal(justBelow.level, "ok");

  const atWarn = evaluateBridgeHealth({
    pollHealthy: true,
    dnakeDbExpectedBytes: Math.ceil(DNAKE_DB_DEFAULT_LIMIT_BYTES * 0.7),
  });
  assert.equal(atWarn.level, "warning");
  assert.deepEqual(atWarn.reasons, ["db_near_limit"]);
  assert.match(atWarn.message, /70%/);
});

test("file troncato ma ancora leggibile -> warning, non critico", () => {
  const health = evaluateBridgeHealth({
    pollHealthy: true,
    dnakeDbPartial: true,
    dnakeDbExpectedBytes: 318464,
    dnakeDbReceivedBytes: 290816,
  });

  assert.equal(health.level, "warning");
  assert.deepEqual(health.reasons, ["db_partial"]);
});

test("il polling fermo vince su tutto il resto", () => {
  const health = evaluateBridgeHealth({
    pollHealthy: false,
    dnakeDbPartial: true,
    dnakeDbExpectedBytes: 10,
  });

  assert.equal(health.level, "critical");
});

test("limite e soglia configurabili (nuovo DNake con limite diverso)", () => {
  const health = evaluateBridgeHealth(
    { pollHealthy: true, dnakeDbExpectedBytes: 600_000 },
    { limitBytes: 1_000_000, warnPercent: 50 },
  );

  assert.equal(health.level, "warning");
  assert.equal(health.db.percent_of_limit, 60);

  const badLimit = evaluateBridgeHealth(
    { pollHealthy: true, dnakeDbExpectedBytes: 100 },
    { limitBytes: 0 },
  );
  assert.equal(badLimit.db.limit_bytes, DNAKE_DB_DEFAULT_LIMIT_BYTES);
});

test("valori non numerici o assurdi non fanno crashare", () => {
  const health = evaluateBridgeHealth({
    pollHealthy: "no",
    dnakeDbExpectedBytes: "tanti",
    dnakeDbReceivedBytes: -5,
    lastPollError: 42,
  });

  assert.equal(health.level, "ok");
  assert.equal(health.polling_healthy, null);
  assert.equal(health.db, null);
});
