import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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

test("returns an error when approval cases lack rollback expectations", async () => {
  const result = await runCli(["validate", missingRollback]);

  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /write-escalate: Approval-required cases need rollback expectations/);
});
