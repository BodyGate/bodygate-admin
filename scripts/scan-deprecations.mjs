#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEPRECATION_CANDIDATES } from "../architecture/deprecation-registry.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignored = /(^|\/)(?:node_modules|\.next|dist|build|coverage|\.cache)(\/|$)|(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/;
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root }).toString().split("\0").filter(Boolean).filter((file) => !ignored.test(file)).sort();
const searchable = files.map((file) => {
  try { return { file, lines: readFileSync(path.join(root, file), "utf8").split(/\r?\n/) }; }
  catch { return { file, lines: [] }; }
});

function patterns(candidate) {
  const values = new Set([candidate.path, ...candidate.repositoryPaths]);
  for (const repositoryPath of candidate.repositoryPaths) {
    const base = path.basename(repositoryPath).replace(/\.(?:tsx?|jsx?|css)$/, "");
    if (base && !["page", "route", "index"].includes(base)) values.add(base);
  }
  return [...values].filter((value) => value.length > 2);
}

function classification(line, candidate, file) {
  if (candidate.repositoryPaths.includes(file)) return "definition";
  if (/\b(?:import|export)\b|import\s*\(/.test(line)) return "import";
  if (/\bfetch\s*\(|router\.(?:push|replace)\s*\(|\bredirect\s*\(|<Link\b|\bhref\s*=/.test(line)) return "call";
  if (/\.(?:md|mdx|txt)$/i.test(file) || file.startsWith("docs/") || file.startsWith("architecture/")) return "documentation";
  return "text";
}

const report = DEPRECATION_CANDIDATES.map((candidate) => {
  const needles = patterns(candidate);
  const references = [];
  for (const { file, lines } of searchable) {
    lines.forEach((line, index) => {
      if (needles.some((needle) => line.includes(needle))) references.push({ file, line: index + 1, classification: classification(line, candidate, file) });
    });
  }
  references.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.classification.localeCompare(b.classification));
  return { id: candidate.id, path: candidate.path, references };
});

if (process.argv.includes("--check")) {
  if (report.length !== DEPRECATION_CANDIDATES.length) throw new Error("Incomplete deterministic scan");
  console.log(`Deprecation scan OK: ${report.length} candidates, ${files.length} tracked files scanned.`);
} else {
  process.stdout.write(`${JSON.stringify({ version: 1, candidates: report }, null, 2)}\n`);
}
