import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { initFixture, renderMatrix, validateFixture } from "../dist/index.js";

test("generates policy cases from local manifests", () => {
  const fixture = initFixture("test/fixtures/actions");
  assert.equal(fixture.cases.length, 6);
  assert.equal(validateFixture(fixture).filter((issue) => issue.level === "error").length, 0);
  assert.match(renderMatrix(fixture), /Connector Policy Matrix/);
});

test("adds deterministic decision coverage for homogeneous action manifests", () => {
  for (const [writes, missingDecision] of [[false, "escalate"], [true, "allow"]]) {
    const dir = mkdtempSync(join(tmpdir(), "connector-policy-homogeneous-"));
    try {
      writeFileSync(join(dir, "action.json"), JSON.stringify({
        id: writes ? "write-action" : "read-action",
        connector: "example",
        action: writes ? "update" : "read",
        target: "record",
        writes
      }));

      const first = initFixture(dir);
      const second = initFixture(dir);
      assert.deepEqual(second, first);
      assert.deepEqual(new Set(first.cases.map((item) => item.decision)), new Set(["allow", "block", "escalate"]));
      assert.equal(first.cases.filter((item) => item.decision === missingDecision).length, 1);
      assert.equal(validateFixture(first).filter((issue) => issue.level === "error").length, 0);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }
});

test("rejects an actions directory with no JSON manifests", () => {
  const dir = mkdtempSync(join(tmpdir(), "connector-policy-empty-"));
  try {
    assert.throws(
      () => initFixture(dir),
      (error) => error.message === `Actions directory contains no JSON manifests: ${dir}`
    );
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("rejects duplicate manifest IDs with deterministic file diagnostics", () => {
  const dir = mkdtempSync(join(tmpdir(), "connector-policy-duplicates-"));
  try {
    const manifest = { id: "same", connector: "example", action: "read", target: "record", writes: false };
    const first = join(dir, "a.json");
    const second = join(dir, "b.json");
    writeFileSync(second, JSON.stringify(manifest));
    writeFileSync(first, JSON.stringify(manifest));
    assert.throws(
      () => initFixture(dir),
      (error) => error.message === `Duplicate action manifest ID "same": ${first}, ${second}.`
    );
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("rejects malformed action manifests with deterministic file and field diagnostics", () => {
  const dir = mkdtempSync(join(tmpdir(), "connector-policy-manifests-"));
  try {
    for (const [value, expected] of [
      [[], "manifest must be a JSON object"],
      [{ connector: "github", action: "read", target: "issue", writes: false }, "field id must be a non-empty string"],
      [{ id: "read", connector: 1, action: "read", target: "issue", writes: false }, "field connector must be a non-empty string"],
      [{ id: "read", connector: "github", action: null, target: "issue", writes: false }, "field action must be a non-empty string"],
      [{ id: "read", connector: "github", action: "read", target: true, writes: false }, "field target must be a non-empty string"],
      [{ id: "read", connector: "github", action: "read", target: "issue", writes: "no" }, "field writes must be a boolean"],
      [{ id: "read", connector: "github", action: "read", target: "issue", writes: false, payload: [] }, "field payload must be a JSON object when provided"]
    ]) {
      const path = join(dir, "bad.json");
      writeFileSync(path, JSON.stringify(value));
      assert.throws(() => initFixture(dir), new RegExp(`Invalid action manifest ${path.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}: ${expected}\\.`));
    }
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("rejects empty required action manifest strings", () => {
  const dir = mkdtempSync(join(tmpdir(), "connector-policy-manifests-"));
  try {
    for (const field of ["id", "connector", "action", "target"]) {
      const path = join(dir, "bad.json");
      const manifest = { id: "read", connector: "github", action: "read", target: "issue", writes: false };
      manifest[field] = field === "id" ? "" : "   ";
      writeFileSync(path, JSON.stringify(manifest));
      assert.throws(
        () => initFixture(dir),
        (error) => error.message === `Invalid action manifest ${path}: field ${field} must be a non-empty string.`
      );
    }
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("identifies the source file when an action manifest is not valid JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "connector-policy-manifests-"));
  const path = join(dir, "broken.json");
  try {
    writeFileSync(path, "{");
    assert.throws(
      () => initFixture(dir),
      (error) => error.message === `Invalid action manifest ${path}: file must contain valid JSON.`
    );
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
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

test("reports deterministic issues for malformed fixture shapes", () => {
  assert.deepEqual(validateFixture(null), [
    { level: "error", caseId: "*", message: "Fixture must be a JSON object." }
  ]);

  assert.deepEqual(validateFixture({ schema: 1, checksum: null }), [
    { level: "error", caseId: "*", message: "Schema must be connector-policy-fixtures/v1." },
    { level: "error", caseId: "*", message: "Generated-from path must be a non-empty string." },
    { level: "error", caseId: "*", message: "Checksum must be 16 lowercase hexadecimal characters." },
    { level: "error", caseId: "*", message: "Cases must be an array." }
  ]);
});

test("reports missing and wrongly typed required case fields", () => {
  const issues = validateFixture({
    schema: "connector-policy-fixtures/v1",
    checksum: "0000000000000000",
    cases: [null, { id: "bad-case", connector: 3, action: "read", target: "item", risk: "urgent", decision: "permit", approvalRequired: "no", rollback: false, payload: [] }]
  });

  assert.ok(issues.some((issue) => issue.caseId === "[0]" && issue.message === "Case must be a JSON object."));
  for (const message of [
    "Case field connector must be a non-empty string.",
    "Case field risk must be low, medium, or high.",
    "Case field decision must be allow, block, or escalate.",
    "Case field approvalRequired must be a boolean.",
    "Case field rollback must be a non-empty string.",
    "Case field payload must be a JSON object."
  ]) assert.ok(issues.some((issue) => issue.caseId === "bad-case" && issue.message === message));
});

test("rejects empty required fixture strings with field-specific issues", () => {
  const fixture = initFixture("test/fixtures/actions");
  const blankCase = {
    ...fixture.cases[0],
    id: " ",
    connector: "",
    action: "\t",
    target: "   ",
    rollback: "\n"
  };
  const issues = validateFixture({ ...fixture, generatedFrom: " ", cases: [blankCase, ...fixture.cases.slice(1)] });

  assert.ok(issues.some((issue) => issue.caseId === "*" && issue.message === "Generated-from path must be a non-empty string."));
  for (const field of ["id", "connector", "action", "target", "rollback"]) {
    assert.ok(issues.some((issue) => issue.caseId === "[0]" && issue.message === `Case field ${field} must be a non-empty string.`));
  }
});

test("matrix rendering rejects invalid fixtures with deterministic validation issues", () => {
  const fixture = initFixture("test/fixtures/actions");
  assert.throws(
    () => renderMatrix({ ...fixture, checksum: "0000000000000000" }),
    /error: \*: Checksum does not match fixture cases; regenerate the fixture\./
  );
  assert.throws(
    () => renderMatrix({ ...fixture, cases: "wrong" }),
    (error) => error.name === "FixtureValidationError"
      && /error: \*: Cases must be an array\./.test(error.message)
      && !/TypeError/.test(error.message)
  );
});

test("built package bin keeps the node shebang", () => {
  const cli = readFileSync("dist/cli.js", "utf8");
  assert.ok(cli.startsWith("#!/usr/bin/env node"));
});
