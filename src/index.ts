import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Decision = "allow" | "block" | "escalate";

export interface ActionManifest {
  id: string;
  connector: string;
  action: string;
  target: string;
  writes: boolean;
  payload?: Record<string, unknown>;
}

export interface PolicyCase {
  id: string;
  connector: string;
  action: string;
  target: string;
  risk: "low" | "medium" | "high";
  decision: Decision;
  approvalRequired: boolean;
  rollback: string;
  payload: Record<string, unknown>;
}

export interface PolicyFixture {
  schema: "connector-policy-fixtures/v1";
  generatedFrom: string;
  checksum: string;
  cases: PolicyCase[];
}

export interface ValidationIssue {
  level: "error" | "warning";
  caseId: string;
  message: string;
}

export function initFixture(actionsDir: string): PolicyFixture {
  const manifests = readManifests(actionsDir);
  const cases = manifests.flatMap((manifest) => buildCases(manifest));
  return {
    schema: "connector-policy-fixtures/v1",
    generatedFrom: actionsDir,
    checksum: checksum(cases),
    cases
  };
}

export function validateFixture(fixture: PolicyFixture): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const decisions = new Set(fixture.cases.map((item) => item.decision));
  for (const decision of ["allow", "block", "escalate"] as const) {
    if (!decisions.has(decision)) {
      issues.push({ level: "error", caseId: "*", message: `Missing ${decision} coverage.` });
    }
  }
  for (const item of fixture.cases) {
    if (item.approvalRequired && item.rollback.trim().length === 0) {
      issues.push({ level: "error", caseId: item.id, message: "Approval-required cases need rollback expectations." });
    }
    if (isBroadTarget(item.target) && item.decision === "allow") {
      issues.push({ level: "warning", caseId: item.id, message: "Broad target is allowed; consider escalation." });
    }
    if (hasSecretLikeValue(item.payload)) {
      issues.push({ level: "error", caseId: item.id, message: "Payload contains secret-looking sample data." });
    }
  }
  return issues;
}

export function renderMatrix(fixture: PolicyFixture): string {
  const rows = fixture.cases.map((item) => {
    return `| ${item.id} | ${item.connector} | ${item.action} | ${item.target} | ${item.risk} | ${item.decision} | ${item.approvalRequired ? "yes" : "no"} | ${item.rollback || "-"} |`;
  });
  return [
    "# Connector Policy Matrix",
    "",
    `Schema: \`${fixture.schema}\``,
    `Checksum: \`${fixture.checksum}\``,
    "",
    "| Case | Connector | Action | Target | Risk | Decision | Approval | Rollback |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    ""
  ].join("\n");
}

function buildCases(manifest: ActionManifest): PolicyCase[] {
  const base = {
    connector: manifest.connector,
    action: manifest.action,
    payload: manifest.payload ?? {}
  };
  return [
    {
      id: `${manifest.id}-allow`,
      ...base,
      target: manifest.target,
      risk: manifest.writes ? "medium" : "low",
      decision: manifest.writes ? "escalate" : "allow",
      approvalRequired: manifest.writes,
      rollback: manifest.writes ? "Undo the local fixture action or restore prior field value." : "No external write."
    },
    {
      id: `${manifest.id}-broad-target`,
      ...base,
      target: "*",
      risk: "high",
      decision: "block",
      approvalRequired: true,
      rollback: "Do not execute broad target actions."
    }
  ];
}

function readManifests(dir: string): ActionManifest[] {
  if (!existsSync(dir)) throw new Error(`Actions directory not found: ${dir}`);
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .map((entry) => JSON.parse(readFileSync(join(dir, entry), "utf8")) as ActionManifest);
}

function isBroadTarget(target: string): boolean {
  return ["*", "all", "workspace", "everyone"].includes(target.toLowerCase());
}

function hasSecretLikeValue(value: unknown): boolean {
  if (typeof value === "string") return /(secret|token|api[_-]?key|password)=?[a-z0-9_-]{8,}/i.test(value);
  if (Array.isArray(value)) return value.some(hasSecretLikeValue);
  if (value && typeof value === "object") return Object.values(value).some(hasSecretLikeValue);
  return false;
}

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
