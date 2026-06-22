# ORCHESTRATION

## Agent Flow

1. Confirm the target path is local and does not require external writes.
2. Run the CLI against fixtures or a candidate skill repo.
3. Review generated JSON and Markdown evidence before using it in a PR.
4. Run verification commands and paste exact results into release-candidate notes.

## Boundaries

This project is local-first. Agents must not publish packages, tag releases, call live connector services, or mutate third-party systems from this workflow.

## Release Candidate Checklist

- `npm test`
- `npm run check`
- `npm run build`
- `npm run smoke`
- `bash scripts/validate.sh`
