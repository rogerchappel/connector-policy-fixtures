import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("CI verifies the release gate on the declared minimum and a current Node release", () => {
  assert.equal(packageJson.engines.node, ">=18");
  assert.match(workflow, /node-version:\s*\[18, 24\]/);
  assert.match(workflow, /run:\s*npm ci/);
  assert.match(workflow, /run:\s*npm run release:check/);
  assert.doesNotMatch(workflow, /npm install/);
});

test("development Node types match the minimum supported major", () => {
  assert.match(packageJson.devDependencies["@types/node"], /^\^18\./);
});
