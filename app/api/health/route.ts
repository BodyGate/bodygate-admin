import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";

export const dynamic = "force-dynamic";

// Vercel injects the deployed commit at runtime; a local checkout (the gym
// PC) has no such env var but does have a real .git directory to ask instead.
// Comparing this field across the local deployment and the Vercel deployment
// is how we catch the two silently drifting apart.
function resolveCommit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd() })
      .toString()
      .trim();
  } catch {
    return null;
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
