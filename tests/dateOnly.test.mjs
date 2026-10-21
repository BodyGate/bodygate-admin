import assert from "node:assert/strict";
import test from "node:test";

import { normalizeDateOnly } from "../app/lib/server/dateOnly.ts";

test("accepts valid dates, including leap day", () => {
  assert.equal(normalizeDateOnly("2026-10-21"), "2026-10-21");
  assert.equal(normalizeDateOnly("2028-02-29"), "2028-02-29");
});

test("rejects non-existent calendar days instead of rolling them over", () => {
  assert.equal(normalizeDateOnly("2026-02-31"), null);
  assert.equal(normalizeDateOnly("2027-02-29"), null);
  assert.equal(normalizeDateOnly("2026-04-31"), null);
  assert.equal(normalizeDateOnly("2026-13-01"), null);
  assert.equal(normalizeDateOnly("2026-00-10"), null);
});

test("rejects malformed input", () => {
  assert.equal(normalizeDateOnly(""), null);
  assert.equal(normalizeDateOnly(undefined), null);
  assert.equal(normalizeDateOnly("21/10/2026"), null);
  assert.equal(normalizeDateOnly("2026-10-21junk"), null);
  assert.equal(normalizeDateOnly("2026-10-21T99:99:99"), null);
});
