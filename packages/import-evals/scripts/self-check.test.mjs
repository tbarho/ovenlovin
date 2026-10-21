import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { computeEvalVerdict } = require(
  join(dirname(require.resolve("eve/package.json")), "dist/src/evals/runner/verdict.js")
);

test("a gated zero score fails the eval (exit non-zero)", () => {
  const verdict = computeEvalVerdict({
    assertions: [{ key: "import", score: 0, threshold: 0.95, passed: false, severity: "gate" }],
  });
  assert.equal(verdict, "failed");
  assert.equal(verdict === "failed" ? 1 : 0, 1);
});

test("a thrown model error fails the eval and keeps the text", () => {
  const error = "No object generated: response did not match schema";
  const verdict = computeEvalVerdict({ error, assertions: [] });
  assert.equal(verdict, "failed");
  assert.match(error, /No object generated/);
});
