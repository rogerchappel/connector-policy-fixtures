# connector-policy-fixtures

## When To Use

Use this skill when preparing connector routing, action dry-runs, CRM/project-management adapters, or release-candidate PRs that need explicit approval policy examples.

## Required Inputs

- Local action manifests or an existing policy fixture JSON file.
- Expected decisions for allow, block, and escalate cases.
- Rollback expectations for write-like actions.

## Side-Effect Boundaries

The workflow is offline and fixture-only. It must not call connector APIs, send messages, update CRMs, create GitHub issues, or persist credentials.

## Approval Requirements

Local validation needs no approval. Any live connector action derived from these fixtures requires separate user confirmation with exact target, action, payload, and rollback plan.

## Examples

```bash
connector-policy-fixtures init fixtures/actions --out fixtures/policy-cases.json
connector-policy-fixtures validate fixtures/policy-cases.json
connector-policy-fixtures matrix fixtures/policy-cases.json --format markdown
```

## Validation Workflow

Run `npm test`, `npm run check`, `npm run build`, `npm run smoke`, and `bash scripts/validate.sh`. Inspect all blocked or escalated cases before relying on the matrix in a PR.
