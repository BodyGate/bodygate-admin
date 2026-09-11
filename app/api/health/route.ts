import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

// Vercel injects the deployed commit at runtime. Locally (the gym PC),
// scripts/write-build-commit.mjs records the commit into .build-commit right
// after `next build` succeeds (see package.json) - reading that instead of a
// live `git rev-parse HEAD` matters because deploy-bodygate.ps1 fast-forwards
// the git checkout *before* building, and rolls back to the previous working
// build if the build then fails. A live git read would report the new
// (unbuilt) commit even though the old build is what's actually running;
// .build-commit only ever reflects a build that actually succeeded.
function resolveCommit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }
  try {
    return readFileSync(join(process.cwd(), ".build-commit"), "utf8").trim();
  } catch {
    // No marker yet (e.g. `npm run dev`, which never runs the build script) -
    // fall back to asking git directly.
    try {
      return execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd() })
        .toString()
        .trim();
    } catch {
      return null;
    }
  }
}

export async function GET() {
  const commit = resolveCommit();

  return NextResponse.json(
    {
      ok: true,
      service: "bodygate-admin",
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      commit,
      commit_short: commit ? commit.slice(0, 7) : null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
