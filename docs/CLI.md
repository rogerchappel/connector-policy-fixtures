# CLI

```bash
connector-policy-fixtures init <actions-dir> --out <policy-cases.json>
connector-policy-fixtures validate <policy-cases.json>
connector-policy-fixtures matrix <policy-cases.json> --format markdown
```

Fixture-backed smoke commands:

```bash
npm run build
node dist/cli.js init test/fixtures/actions --out tmp/policy-cases.json
node dist/cli.js validate tmp/policy-cases.json
node dist/cli.js matrix tmp/policy-cases.json --format markdown
node dist/cli.js validate test/fixtures/policy-missing-rollback.json
```

Exit behavior:

- `0`: command completed and validation found no errors.
- `1`: command failed, input could not be read, or validation found an error-level issue.

Validation warnings are printed to stderr but do not fail the command unless an error-level issue is also present.
