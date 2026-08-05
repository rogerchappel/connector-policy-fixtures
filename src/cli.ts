#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { formatValidationIssues, initFixture, renderMatrix, validateFixture, type PolicyFixture } from "./index.js";

export async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  if (!command || command === "--help" || command === "-h") {
    if (args.length > 0) throw new Error("Help does not accept arguments.");
    printHelp();
    return;
  }

  if (command === "init") {
    const { target, options } = parseArgs(command, args, { required: ["--out"] });
    const fixture = initFixture(target);
    const out = options.get("--out")!;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
    return;
  }

  if (command === "validate") {
    const { target } = parseArgs(command, args);
    const fixture: unknown = readFixture(target);
    const issues = validateFixture(fixture);
    if (issues.length > 0) console.error(formatValidationIssues(issues));
    if (issues.some((issue) => issue.level === "error")) process.exitCode = 1;
    if (issues.length === 0) console.log(`Policy fixture valid: ${(fixture as PolicyFixture).cases.length} cases.`);
    return;
  }

  if (command === "matrix" || command === "render") {
    const { target, options } = parseArgs(command, args, command === "matrix" ? { optional: ["--format"] } : undefined);
    const format = options.get("--format");
    if (format !== undefined && format !== "markdown") {
      throw new Error(`Unsupported matrix format: ${format}. Expected markdown.`);
    }
    console.log(renderMatrix(readFixture(target)));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function readFixture(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

interface CommandOptions {
  required?: string[];
  optional?: string[];
}

function parseArgs(command: string, args: string[], spec: CommandOptions = {}): { target: string; options: Map<string, string> } {
  const allowed = new Set([...(spec.required ?? []), ...(spec.optional ?? [])]);
  const options = new Map<string, string>();
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("-")) {
      positionals.push(arg);
      continue;
    }
    if (!allowed.has(arg)) throw new Error(`Unknown option for ${command}: ${arg}.`);
    if (options.has(arg)) throw new Error(`Duplicate option for ${command}: ${arg}.`);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("-")) throw new Error(`Missing value for ${arg}.`);
    options.set(arg, value);
    index += 1;
  }

  if (positionals.length === 0) throw new Error(`Missing target for ${command}.`);
  if (positionals.length > 1) throw new Error(`Unexpected argument for ${command}: ${positionals[1]}.`);
  for (const name of spec.required ?? []) {
    if (!options.has(name)) throw new Error(`${command} requires ${name} <file>.`);
  }
  return { target: positionals[0], options };
}

function printHelp(): void {
  console.log(`connector-policy-fixtures init <actions-dir> --out <file>\nconnector-policy-fixtures validate <policy-cases.json>\nconnector-policy-fixtures matrix <policy-cases.json> [--format markdown]\nconnector-policy-fixtures render <policy-cases.json>\n\nOptions may appear before or after the target. matrix and render validate fixtures before producing output.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
