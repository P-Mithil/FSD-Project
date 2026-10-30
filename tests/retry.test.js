import test from "node:test";
import assert from "node:assert/strict";
import { retryAfterSeconds } from "../src/retry.js";

test("Retry-After supports delta seconds, HTTP dates, invalid values and zero", () => {
  const now = Date.parse("2026-11-01T00:00:00Z");
  assert.equal(retryAfterSeconds("17", now), 17);
  assert.equal(retryAfterSeconds("1.5", now), 2);
  assert.equal(retryAfterSeconds("Sun, 01 Nov 2026 00:02:00 GMT", now), 120);
  assert.equal(retryAfterSeconds("0", now), 0);
  assert.equal(retryAfterSeconds("unknown", now), null);
  assert.equal(retryAfterSeconds(null, now), null);
});
