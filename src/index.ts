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

export class FixtureValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(formatValidationIssues(issues));
    this.name = "FixtureValidationError";
  }
}

export function formatValidationIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `${issue.level}: ${issue.caseId}: ${issue.message}`).join("\n");
}

const FIXTURE_SCHEMA: PolicyFixture["schema"] = "connector-policy-fixtures/v1";
const CHECKSUM_PATTERN = /^[0-9a-f]{16}$/;

export function initFixture(actionsDir: string): PolicyFixture {
  const manifests = readManifests(actionsDir);
  const cases = ensureDecisionCoverage(
    manifests.flatMap((manifest) => buildCases(manifest)),
    manifests[0]
  );
  return {
    schema: FIXTURE_SCHEMA,
    generatedFrom: actionsDir,
    checksum: checksum(cases),
    cases
  };
}

function ensureDecisionCoverage(cases: PolicyCase[], manifest: ActionManifest | undefined): PolicyCase[] {
  if (!manifest) return cases;
  const decisions = new Set(cases.map((item) => item.decision));
  if (!decisions.has("allow")) return [...cases, buildCoverageCase(manifest, "allow", cases)];
  if (!decisions.has("escalate")) return [...cases, buildCoverageCase(manifest, "escalate", cases)];
  return cases;
}

function buildCoverageCase(
  manifest: ActionManifest,
  decision: "allow" | "escalate",
  existingCases: PolicyCase[]
): PolicyCase {
  const approvalRequired = decision === "escalate";
  return {
    id: uniqueCaseId(`${manifest.id}-coverage-${decision}`, existingCases),
    connector: manifest.connector,
    action: manifest.action,
    target: manifest.target,
    risk: decision === "allow" ? "low" : "medium",
    decision,
    approvalRequired,
    rollback: approvalRequired
      ? "Undo the local fixture action or restore prior field value."
      : manifest.writes ? "Restore the prior field value after the allowed test case." : "No external write.",
    payload: manifest.payload ?? {}
  };
}

function uniqueCaseId(base: string, existingCases: PolicyCase[]): string {
  const existingIds = new Set(existingCases.map((item) => item.id));
  if (!existingIds.has(base)) return base;
  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function validateFixture(fixture: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(fixture)) {
    return [{ level: "error", caseId: "*", message: "Fixture must be a JSON object." }];
  }
  if (fixture.schema !== FIXTURE_SCHEMA) {
    issues.push({ level: "error", caseId: "*", message: `Schema must be ${FIXTURE_SCHEMA}.` });
  }
  if (!isNonEmptyString(fixture.generatedFrom)) {
    issues.push({ level: "error", caseId: "*", message: "Generated-from path must be a non-empty string." });
  }
  if (typeof fixture.checksum !== "string" || !CHECKSUM_PATTERN.test(fixture.checksum)) {
    issues.push({ level: "error", caseId: "*", message: "Checksum must be 16 lowercase hexadecimal characters." });
  }
  if (!Array.isArray(fixture.cases)) {
    issues.push({ level: "error", caseId: "*", message: "Cases must be an array." });
    return issues;
  }

  const cases: PolicyCase[] = [];
  fixture.cases.forEach((item, index) => {
    const caseIssues = validateCaseShape(item, index);
    issues.push(...caseIssues);
    if (caseIssues.length === 0) cases.push(item as unknown as PolicyCase);
  });

  if (typeof fixture.checksum === "string" && CHECKSUM_PATTERN.test(fixture.checksum) && fixture.checksum !== checksum(fixture.cases)) {
    issues.push({
      level: "error",
      caseId: "*",
      message: "Checksum does not match fixture cases; regenerate the fixture."
    });
  }

  const seenCaseIds = new Set<string>();
  const reportedDuplicateIds = new Set<string>();
  for (const item of cases) {
    if (item.decision === "allow" && item.approvalRequired) {
      issues.push({ level: "error", caseId: item.id, message: "Allow cases must not require approval." });
    }
    if ((item.decision === "block" || item.decision === "escalate") && !item.approvalRequired) {
      issues.push({ level: "error", caseId: item.id, message: `${capitalize(item.decision)} cases must require approval.` });
    }
    if (seenCaseIds.has(item.id) && !reportedDuplicateIds.has(item.id)) {
      issues.push({ level: "error", caseId: item.id, message: "Duplicate case ID." });
      reportedDuplicateIds.add(item.id);
    }
    seenCaseIds.add(item.id);
  }

  const decisions = new Set(cases.map((item) => item.decision));
  for (const decision of ["allow", "block", "escalate"] as const) {
    if (!decisions.has(decision)) {
      issues.push({ level: "error", caseId: "*", message: `Missing ${decision} coverage.` });
    }
  }
  for (const item of cases) {
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

function validateCaseShape(value: unknown, index: number): ValidationIssue[] {
  const caseId = isRecord(value) && isNonEmptyString(value.id) ? value.id : `[${index}]`;
  if (!isRecord(value)) {
    return [{ level: "error", caseId, message: "Case must be a JSON object." }];
  }

  const issues: ValidationIssue[] = [];
  const stringFields = ["id", "connector", "action", "target", "rollback"] as const;
  for (const field of stringFields) {
    if (!isNonEmptyString(value[field])) {
      issues.push({ level: "error", caseId, message: `Case field ${field} must be a non-empty string.` });
    }
  }
  if (!(["low", "medium", "high"] as unknown[]).includes(value.risk)) {
    issues.push({ level: "error", caseId, message: "Case field risk must be low, medium, or high." });
  }
  if (!(["allow", "block", "escalate"] as unknown[]).includes(value.decision)) {
    issues.push({ level: "error", caseId, message: "Case field decision must be allow, block, or escalate." });
  }
  if (typeof value.approvalRequired !== "boolean") {
    issues.push({ level: "error", caseId, message: "Case field approvalRequired must be a boolean." });
  }
  if (!isRecord(value.payload)) {
    issues.push({ level: "error", caseId, message: "Case field payload must be a JSON object." });
  }
  return issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function renderMatrix(input: unknown): string {
  const issues = validateFixture(input);
  if (issues.some((issue) => issue.level === "error")) {
    throw new FixtureValidationError(issues);
  }
  const fixture = input as PolicyFixture;
  const rows = fixture.cases.map((item) => {
    const fields = [item.id, item.connector, item.action, item.target, item.risk, item.decision, item.approvalRequired ? "yes" : "no", item.rollback || "-"];
    return `| ${fields.map(markdownCell).join(" | ")} |`;
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

function markdownCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n|\r/g, " ");
}

function capitalize(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
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
  const entries = readdirSync(dir)
    .filter((entry) => entry.endsWith(".json"))
    .sort();
  if (entries.length === 0) {
    throw new Error(`Actions directory contains no JSON manifests: ${dir}`);
  }

  const manifestPaths = new Map<string, string>();
  return entries.map((entry) => {
      const path = join(dir, entry);
      let value: unknown;
      try {
        value = JSON.parse(readFileSync(path, "utf8"));
      } catch {
        throw new Error(`Invalid action manifest ${path}: file must contain valid JSON.`);
      }
      validateActionManifest(value, path);
      const previousPath = manifestPaths.get(value.id);
      if (previousPath) {
        throw new Error(`Duplicate action manifest ID "${value.id}": ${previousPath}, ${path}.`);
      }
      manifestPaths.set(value.id, path);
      return value;
    });
}

function validateActionManifest(value: unknown, path: string): asserts value is ActionManifest {
  if (!isRecord(value)) throw new Error(`Invalid action manifest ${path}: manifest must be a JSON object.`);

  for (const field of ["id", "connector", "action", "target"] as const) {
    if (!isNonEmptyString(value[field])) {
      throw new Error(`Invalid action manifest ${path}: field ${field} must be a non-empty string.`);
    }
  }
  if (typeof value.writes !== "boolean") {
    throw new Error(`Invalid action manifest ${path}: field writes must be a boolean.`);
  }
  if (value.payload !== undefined && !isRecord(value.payload)) {
    throw new Error(`Invalid action manifest ${path}: field payload must be a JSON object when provided.`);
  }
}

function isBroadTarget(target: string): boolean {
  return /^(?:\*|[@#]?(?:all|all-hands|workspace|everyone|org|organization))$/i.test(target.trim());
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
