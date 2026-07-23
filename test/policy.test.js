import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("rejects an unsupported or missing fixture schema", () => {
  const fixture = initFixture("test/fixtures/actions");

  for (const schema of ["connector-policy-fixtures/v9", undefined]) {
    const issues = validateFixture({ ...fixture, schema });
    assert.ok(issues.some((issue) => issue.message === "Schema must be connector-policy-fixtures/v1."));
  }
});

test("rejects malformed and stale fixture checksums", () => {
  const fixture = initFixture("test/fixtures/actions");
  const malformed = validateFixture({ ...fixture, checksum: "not-a-checksum" });
  assert.ok(malformed.some((issue) => issue.message === "Checksum must be 16 lowercase hexadecimal characters."));

  const stale = validateFixture({
    ...fixture,
    cases: fixture.cases.map((item, index) => index === 0 ? { ...item, target: "changed-target" } : item)
  });
  assert.ok(stale.some((issue) => issue.message === "Checksum does not match fixture cases; regenerate the fixture."));
});

test("rejects duplicate case IDs", () => {
  const fixture = initFixture("test/fixtures/actions");
  const duplicate = fixture.cases[0];
  const issues = validateFixture({ ...fixture, cases: [...fixture.cases, duplicate] });

  assert.ok(issues.some((issue) =>
    issue.caseId === duplicate.id && issue.message === "Duplicate case ID."
  ));
});

test("built package bin keeps the node shebang", () => {
  const cli = readFileSync("dist/cli.js", "utf8");
  assert.ok(cli.startsWith("#!/usr/bin/env node"));
});
