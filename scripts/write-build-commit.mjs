import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// Runs only after `next build` exits 0 (see package.json's build script), so
// .build-commit always reflects the commit that actually produced the code
// currently on disk - never a commit whose build failed and got rolled back.
const commit = execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
writeFileSync(".build-commit", commit);
