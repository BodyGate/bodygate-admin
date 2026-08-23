import test from "node:test"
import { execFileSync } from "node:child_process"
test("the Platinum screen registry observes isolation and coverage guardrails", () => { execFileSync(process.execPath, ["scripts/qa-platinum-screens.mjs"], { stdio: "pipe" }) })
