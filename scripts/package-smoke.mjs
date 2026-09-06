import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sandbox = mkdtempSync(join(tmpdir(), "connector-policy-fixtures-package-"));

try {
  const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  for (const file of trackedFiles) {
    mkdirSync(join(sandbox, file, ".."), { recursive: true });
    cpSync(file, join(sandbox, file), { recursive: true });
  }

  execFileSync("npm", ["ci", "--ignore-scripts"], { cwd: sandbox, stdio: "inherit" });
  if (existsSync(join(sandbox, "dist"))) {
    throw new Error("Clean package sandbox unexpectedly contains dist before npm pack");
  }

  const output = execFileSync("npm", ["pack", "--json"], {
    cwd: sandbox,
    encoding: "utf8"
  });
  const [pack] = JSON.parse(output);
  const files = new Set(pack.files.map((file) => file.path));

const required = [
  "dist/cli.js",
  "dist/index.js",
  "docs/PRD.md",
  "SKILL.md",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md"
];

  const missing = required.filter((file) => !files.has(file));
  if (missing.length) {
    throw new Error(`Package smoke failed; missing files:\n${missing.join("\n")}`);
  }
  const unintended = [...files].filter((file) =>
    /^(?:src|test|scripts)\//.test(file) || /^dist\/.*\.test\.(?:js|d\.ts)$/.test(file)
  );
  if (unintended.length) {
    throw new Error(`Package smoke failed; unintended files:\n${unintended.join("\n")}`);
  }

  const packageJson = JSON.parse(readFileSync(join(sandbox, "package.json"), "utf8"));
  if (packageJson.bin?.["connector-policy-fixtures"] !== "./dist/cli.js") {
    throw new Error("Package smoke failed; connector-policy-fixtures bin does not point at ./dist/cli.js");
  }

  execFileSync("tar", ["-xzf", pack.filename, "-C", sandbox], { cwd: sandbox });
  const installedPackage = join(sandbox, "package");
  const cliSource = readFileSync(join(installedPackage, "dist/cli.js"), "utf8");
  if (!cliSource.startsWith("#!/usr/bin/env node")) {
    throw new Error("Package smoke failed; built CLI is missing the node shebang");
  }
  const help = execFileSync("node", [join(installedPackage, packageJson.bin["connector-policy-fixtures"]), "--help"], {
    encoding: "utf8"
  });
  if (!help.includes("connector-policy-fixtures")) {
    throw new Error("Package smoke failed; installed CLI help did not identify the command");
  }

  console.log(`package smoke ok: ${pack.filename} includes ${pack.files.length} files and its CLI prints help`);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
