import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { DEPRECATION_CANDIDATES, CONFIDENCE_LEVELS, PROPOSED_DECISIONS } from "../architecture/deprecation-registry.mts";
import { ROUTE_MANIFEST } from "../architecture/route-manifest.mts";

const duplicates = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort();

test("registry IDs are unique and declared repository paths exist", () => {
  assert.deepEqual(duplicates(DEPRECATION_CANDIDATES.map(({ id }) => id)), []);
  for (const item of DEPRECATION_CANDIDATES) {
    assert.ok(PROPOSED_DECISIONS.includes(item.proposedDecision));
    assert.ok(CONFIDENCE_LEVELS.includes(item.confidence));
    for (const repositoryPath of item.repositoryPaths) assert.ok(existsSync(repositoryPath), `${item.id}: ${repositoryPath}`);
  }
});

test("page candidates are governed by the route manifest", () => {
  const routes = new Set(ROUTE_MANIFEST.map(({ path }) => path));
  for (const item of DEPRECATION_CANDIDATES.filter(({ kind }) => kind === "route")) assert.ok(routes.has(item.path), item.path);
});

test("every candidate has accountable risk, owner, rollback and evidence gaps", () => {
  for (const item of DEPRECATION_CANDIDATES) {
    assert.ok(item.owner && item.risk && item.rollbackPlan, item.id);
    assert.ok(item.evidenceGaps.length > 0 || item.runtimeEvidence.length > 0, `${item.id}: evidence`);
    if (item.confidence === "verified") assert.ok(item.runtimeEvidence.length > 0, `${item.id}: verified requires runtime evidence`);
  }
});

test("critical, token, access and hardware candidates cannot be immediately removed", () => {
  const immediateRemoval = new Set(["deprecate", "remove-after-evidence"]);
  for (const item of DEPRECATION_CANDIDATES) {
    if (item.risk === "critical") assert.ok(!immediateRemoval.has(item.proposedDecision), item.id);
    if (item.tokenCompatibilityRisk !== "Not token-addressed.") assert.ok(!immediateRemoval.has(item.proposedDecision), item.id);
    if (item.hardwareDependencies.length || item.path.startsWith("/access")) {
      assert.ok(item.proposedDecision === "protected-do-not-touch" || item.risk === "critical", item.id);
    }
  }
});

test("mandatory candidate definitions remain tracked and the registry is architecture-only", () => {
  const mandatory = ["app/components/CustomersTable.backup.tsx", "app/components/Sidebar.backup.tsx", "app/api/admin/test/route.ts", "app/access/check/route.ts"];
  for (const file of mandatory) assert.ok(existsSync(file), `${file} must not be deleted`);
  let output = "";
  try {
    output = execFileSync("git", ["grep", "-n", "deprecation-registry", "--", "app", "middleware.ts"], { encoding: "utf8" });
  } catch (error) {
    assert.equal(error.status, 1, "git grep itself failed");
  }
  assert.equal(output, "", "application runtime must not import the architecture registry");
  for (const file of mandatory) assert.doesNotMatch(readFileSync(file, "utf8"), /deprecation-registry/);
});
