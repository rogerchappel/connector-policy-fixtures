import assert from "node:assert/strict";
import { test } from "node:test";
import { initFixture, renderMatrix, validateFixture } from "../dist/index.js";

test("generates policy cases from local manifests", () => {
  const fixture = initFixture("test/fixtures/actions");
  assert.equal(fixture.cases.length, 6);
  assert.equal(validateFixture(fixture).filter((issue) => issue.level === "error").length, 0);
  assert.match(renderMatrix(fixture), /Connector Policy Matrix/);
});

test("flags secret-looking payloads", () => {
  const fixture = initFixture("test/fixtures/unsafe-actions");
  const issues = validateFixture(fixture);
  assert.ok(issues.some((issue) => issue.message.includes("secret-looking")));
});
