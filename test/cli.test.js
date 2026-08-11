import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const actionsDir = fileURLToPath(new URL("fixtures/actions", import.meta.url));
const missingRollback = fileURLToPath(new URL("fixtures/policy-missing-rollback.json", import.meta.url));

async function runCli(args) {
  try {
    const result = await execFileAsync(process.execPath, [cli, ...args]);
    return { code: 0, ...result };
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout,
      stderr: error.stderr
    };
  }
}

test("prints the command summary for help", async () => {
  const result = await runCli(["--help"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /connector-policy-fixtures init/);
  assert.equal(result.stderr, "");
});

test("initializes and validates policy cases through the CLI", async () => {
  const dir = await mkdtemp(join(tmpdir(), "connector-policy-fixtures-"));
  const out = join(dir, "policy-cases.json");

  try {
    const init = await runCli(["init", actionsDir, "--out", out]);
    assert.equal(init.code, 0);
    assert.equal(init.stderr, "");

    const fixture = JSON.parse(await readFile(out, "utf8"));
    assert.equal(fixture.cases.length, 6);

    const validate = await runCli(["validate", out]);
    assert.equal(validate.code, 0);
    assert.match(validate.stdout, /Policy fixture valid: 6 cases/);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test("initializes immediately valid fixtures for homogeneous action directories", async () => {
  for (const writes of [false, true]) {
    const dir = await mkdtemp(join(tmpdir(), "connector-policy-homogeneous-"));
    const manifests = join(dir, "actions");
    const out = join(dir, "policy-cases.json");
    try {
      await mkdir(manifests);
      await writeFile(join(manifests, "action.json"), JSON.stringify({
        id: writes ? "write-action" : "read-action",
        connector: "example",
        action: writes ? "update" : "read",
        target: "record",
        writes
      }));

      const init = await runCli(["init", manifests, "--out", out]);
      assert.equal(init.code, 0);
      assert.equal(init.stderr, "");

      const validate = await runCli(["validate", out]);
      assert.equal(validate.code, 0);
      assert.match(validate.stdout, /Policy fixture valid: 3 cases/);
      assert.equal(validate.stderr, "");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  }
});

test("init rejects malformed manifests without creating output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "connector-policy-fixtures-"));
  const manifests = join(dir, "actions");
  const out = join(dir, "nested", "policy-cases.json");
  try {
    await mkdir(manifests);
    await writeFile(join(manifests, "bad.json"), JSON.stringify({ id: "bad", connector: "test", action: "write", target: "item", writes: false, payload: [] }));

    const result = await runCli(["init", manifests, "--out", out]);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, `Invalid action manifest ${join(manifests, "bad.json")}: field payload must be a JSON object when provided.\n`);
    await assert.rejects(access(out));
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test("renders a markdown policy matrix through the CLI", async () => {
  const dir = await mkdtemp(join(tmpdir(), "connector-policy-fixtures-"));
  const out = join(dir, "policy-cases.json");

  try {
    await runCli(["init", actionsDir, "--out", out]);

    const matrix = await runCli(["matrix", out]);
    assert.equal(matrix.code, 0);
    assert.match(matrix.stdout, /# Connector Policy Matrix/);
    assert.match(matrix.stdout, /crm-update-broad-target/);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test("accepts init and matrix options on either side of the target", async () => {
  const dir = await mkdtemp(join(tmpdir(), "connector-policy-fixtures-"));
  const out = join(dir, "policy-cases.json");
  try {
    const init = await runCli(["init", "--out", out, actionsDir]);
    assert.equal(init.code, 0);
    const matrix = await runCli(["matrix", "--format", "markdown", out]);
    assert.equal(matrix.code, 0);
    assert.match(matrix.stdout, /# Connector Policy Matrix/);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test("rejects invalid command arguments before reading or writing files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "connector-policy-fixtures-"));
  const missing = join(dir, "missing.json");
  const output = join(dir, "output.json");
  try {
    for (const [args, expected] of [
      [["validate", missing, "extra"], "Unexpected argument for validate: extra.\n"],
      [["validate", missing, "--verbose"], "Unknown option for validate: --verbose.\n"],
      [["init", actionsDir, "--out", output, "--out", join(dir, "second.json")], "Duplicate option for init: --out.\n"],
      [["init", actionsDir, "--out"], "Missing value for --out.\n"],
      [["matrix", missing, "--format", "json"], "Unsupported matrix format: json. Expected markdown.\n"],
      [["matrix", missing, "--format", "markdown", "--format", "markdown"], "Duplicate option for matrix: --format.\n"],
      [["render", missing, "--format", "markdown"], "Unknown option for render: --format.\n"]
    ]) {
      const result = await runCli(args);
      assert.equal(result.code, 1);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, expected);
    }
    await assert.rejects(access(output));
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test("matrix and render reject invalid fixtures without emitting a matrix", async () => {
  const dir = await mkdtemp(join(tmpdir(), "connector-policy-fixtures-"));
  try {
    for (const [name, fixture, expected] of [
      ["checksum.json", { schema: "connector-policy-fixtures/v1", generatedFrom: "test", checksum: "0000000000000000", cases: [] }, /Checksum does not match fixture cases/],
      ["empty.json", { schema: "connector-policy-fixtures/v1", generatedFrom: "test", checksum: "4f53cda18c2baa0c", cases: [] }, /Missing allow coverage/],
      ["wrong-type.json", { schema: "connector-policy-fixtures/v1", generatedFrom: "test", checksum: "0000000000000000", cases: "wrong" }, /Cases must be an array/]
    ]) {
      const path = join(dir, name);
      await writeFile(path, `${JSON.stringify(fixture)}\n`);
      for (const command of ["matrix", "render"]) {
        const result = await runCli([command, path]);
        assert.equal(result.code, 1);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, expected);
        assert.match(result.stderr, /^error: /);
        assert.doesNotMatch(result.stderr, /TypeError|Connector Policy Matrix/);
      }
    }
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test("returns an error when approval cases lack rollback expectations", async () => {
  const result = await runCli(["validate", missingRollback]);

  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /write-escalate: Approval-required cases need rollback expectations/);
});

test("reports fixture integrity failures through the CLI", async () => {
  const dir = await mkdtemp(join(tmpdir(), "connector-policy-fixtures-"));
  const out = join(dir, "policy-cases.json");

  try {
    await runCli(["init", actionsDir, "--out", out]);
    const fixture = JSON.parse(await readFile(out, "utf8"));
    fixture.schema = "connector-policy-fixtures/v9";
    fixture.checksum = "0000000000000000";
    fixture.cases.push(fixture.cases[0]);
    await writeFile(out, `${JSON.stringify(fixture, null, 2)}\n`);

    const result = await runCli(["validate", out]);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /error: \*: Schema must be connector-policy-fixtures\/v1\./);
    assert.match(result.stderr, /error: \*: Checksum does not match fixture cases; regenerate the fixture\./);
    assert.match(result.stderr, new RegExp(`error: ${fixture.cases[0].id}: Duplicate case ID\\.`));
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test("reports malformed fixture shapes without internal errors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "connector-policy-fixtures-"));
  try {
    for (const [name, fixture, expected] of [
      ["array.json", [], /Fixture must be a JSON object/],
      ["missing-cases.json", {}, /Cases must be an array/],
      ["bad-case.json", { schema: "connector-policy-fixtures\/v1", checksum: "0000000000000000", cases: [{}] }, /Case field id must be a string/]
    ]) {
      const path = join(dir, name);
      await writeFile(path, `${JSON.stringify(fixture)}\n`);
      const result = await runCli(["validate", path]);
      assert.equal(result.code, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, expected);
      assert.doesNotMatch(result.stderr, /TypeError|not iterable/);
    }
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});
