# PRD: connector-policy-fixtures

Status: in-progress
Decision: build next
Created: 2026-06-22

## Pitch

`connector-policy-fixtures` generates and validates local policy fixtures for connector action approvals, helping agents test which planned actions should be allowed, blocked, or escalated before any external write.

## Why It Matters

Connector dry-runs are stronger when backed by explicit policy examples. Teams need a small fixture format for targets, payload fields, risk levels, approval requirements, rollback expectations, and expected policy decisions.

## Source / Attribution

Inspired by Roger's connector routing, action dry-run, CRM adapter, and today's `connector-rehearsal-skill` build. It should use only local sample manifests and must never call live connector services in V1.

## V1 Scope

- TypeScript CLI with `init`, `validate`, `matrix`, and `render`.
- Canonical JSON fixture schema for connector policy cases.
- Starter fixture generation from sample action manifests.
- Validate allow/block/escalate coverage, rollback requirements, broad target cases, and secret-looking payload examples.
- Render Markdown policy matrices for pull requests.
- Include Slack-like, CRM-like, and GitHub-like local fixtures.

## Out of Scope

- Executing connector actions.
- Replacing production authorization systems.
- Storing credentials or account data.

## CLI Sketch

```bash
connector-policy-fixtures init fixtures/actions --out fixtures/policy-cases.json
connector-policy-fixtures validate fixtures/policy-cases.json
connector-policy-fixtures matrix fixtures/policy-cases.json --format markdown
```

## Required Deliverables

- `docs/PRD.md`, `docs/TASKS.md`, and `docs/ORCHESTRATION.md`.
- `SKILL.md` with side-effect boundaries and approval requirements.
- Local CLI/library API, fixtures, tests, smoke script, package metadata, README, and release-candidate notes.

## Verification

Run `npm test`, `npm run check`, `npm run build`, `npm run smoke`, `bash scripts/validate.sh`, and a CLI fixture smoke.

## Agent Prompt

Build `connector-policy-fixtures` as a local-first connector policy fixture toolkit. Keep all behavior offline and make policy decisions explicit, testable, and reviewable.
