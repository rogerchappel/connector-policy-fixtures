#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initFixture, renderMatrix, validateFixture, type PolicyFixture } from "./index.js";

export async function main(argv: string[]): Promise<void> {
  const [command, target, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (!target) throw new Error(`Missing target for ${command}.`);

  if (command === "init") {
    const fixture = initFixture(target);
    const out = option(rest, "--out");
    if (!out) throw new Error("init requires --out <file>.");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
    return;
  }

  if (command === "validate") {
    const fixture = readFixture(target);
    const issues = validateFixture(fixture);
    for (const issue of issues) {
      console.error(`${issue.level}: ${issue.caseId}: ${issue.message}`);
    }
    if (issues.some((issue) => issue.level === "error")) process.exitCode = 1;
    if (issues.length === 0) console.log(`Policy fixture valid: ${fixture.cases.length} cases.`);
    return;
  }

  if (command === "matrix" || command === "render") {
    console.log(renderMatrix(readFixture(target)));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function readFixture(path: string): PolicyFixture {
  return JSON.parse(readFileSync(path, "utf8")) as PolicyFixture;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function printHelp(): void {
  console.log(`connector-policy-fixtures init <actions-dir> --out <file>\nconnector-policy-fixtures validate <policy-cases.json>\nconnector-policy-fixtures matrix <policy-cases.json> --format markdown`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
