import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ROUTE_MANIFEST } from "../architecture/route-manifest.mts";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const APP_DIRECTORY = path.join(TEST_DIRECTORY, "..", "app");

function findPageFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return findPageFiles(entryPath);
    }

    return entry.isFile() && entry.name === "page.tsx" ? [entryPath] : [];
  });
}

function pageFileToRoute(pageFile) {
  const relativeDirectory = path.relative(APP_DIRECTORY, path.dirname(pageFile));
  const segments = relativeDirectory === "" ? [] : relativeDirectory.split(path.sep);
  const routeSegments = segments.filter(
    (segment) => !(segment.startsWith("(") && segment.endsWith(")")) && !segment.startsWith("@"),
  );

  return routeSegments.length === 0 ? "/" : `/${routeSegments.join("/")}`;
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();

  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }

  return [...repeated].sort();
}

test("route manifest exactly matches every App Router page", () => {
  const filesystemRoutes = findPageFiles(APP_DIRECTORY).map(pageFileToRoute).sort();
  const manifestRoutes = ROUTE_MANIFEST.map((route) => route.path).sort();

  assert.deepEqual(duplicates(filesystemRoutes), [], "filesystem pages resolve to duplicate routes");
  assert.deepEqual(duplicates(manifestRoutes), [], "manifest contains duplicate paths");
  assert.deepEqual(manifestRoutes, filesystemRoutes, "filesystem and manifest routes differ");
});

test("route manifest IDs are unique and entries are not planned", () => {
  assert.deepEqual(duplicates(ROUTE_MANIFEST.map((route) => route.id)), [], "manifest contains duplicate IDs");
  assert.equal(
    ROUTE_MANIFEST.some((route) => route.status === "planned"),
    false,
    "planned routes are forbidden",
  );
});

test("mandatory route classifications are enforced", () => {
  const classifications = new Map(ROUTE_MANIFEST.map((route) => [route.path, route.classification]));
  const required = {
    "/access": "legacy-redirect",
    "/settings/modules": "placeholder",
    "/test-gate": "technical",
    "/ui-lab": "lab",
    "/ui-lab/platinum": "lab",
    "/v2/customers": "prototype",
  };

  for (const [route, classification] of Object.entries(required)) {
    assert.equal(classifications.get(route), classification, `${route} must be classified as ${classification}`);
  }
});
