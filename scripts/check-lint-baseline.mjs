#!/usr/bin/env node
// BG-P1-002 step 1: capture the current lint baseline and block regressions,
// without requiring the full pre-existing lint debt to be fixed up front.
// Raise the baseline down over time as debt is paid off; never raise it up.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const baselinePath = join(root, ".lint-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

let output;
try {
  output = execFileSync("npx", ["eslint", ".", "--format", "json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
} catch (error) {
  // eslint exits non-zero when it finds errors; stdout still holds the JSON report.
  output = error.stdout;
}

const results = JSON.parse(output);
const errorCount = results.reduce((sum, file) => sum + file.errorCount, 0);
const warningCount = results.reduce((sum, file) => sum + file.warningCount, 0);

console.log(
  `Lint: ${errorCount} error(s), ${warningCount} warning(s) (baseline: ${baseline.maxErrors} error(s) max)`
);

if (errorCount > baseline.maxErrors) {
  console.error(
    `\nFAIL: lint errors increased from the ${baseline.maxErrors}-error baseline to ${errorCount}.\n` +
      "Fix the new error(s) introduced by this change, or pay down existing debt and lower " +
      "maxErrors in .lint-baseline.json to match — never raise it to make a regression pass."
  );
  process.exit(1);
}

if (errorCount < baseline.maxErrors) {
  console.log(
    `\nLint errors dropped below the baseline (${errorCount} < ${baseline.maxErrors}). ` +
      "Consider lowering maxErrors in .lint-baseline.json to lock in the improvement."
  );
}

process.exit(0);
