# connector-policy-fixtures

`connector-policy-fixtures` generates and validates offline policy cases for connector action approvals. It helps agents test allow, block, and escalate decisions before any external write is attempted.

## Quickstart

```bash
npm install
npm run build
node dist/cli.js init test/fixtures/actions --out tmp/policy-cases.json
node dist/cli.js validate tmp/policy-cases.json
node dist/cli.js matrix tmp/policy-cases.json --format markdown
```

## CLI

- `init <actions-dir> --out <file>` creates starter policy cases from local action manifests.
- `validate <file>` checks coverage, rollback requirements, broad targets, and secret-looking payloads.
- `matrix <file> --format markdown` renders a policy decision matrix.
- `render <file>` is an alias for `matrix`.

See [docs/CLI.md](docs/CLI.md) for fixture-backed smoke commands and exit behavior.

## Safety Notes

The CLI never executes connector actions and never contacts live services. Keep examples synthetic and avoid credentials, private account IDs, or production payloads.

## Release Verification

```bash
npm run release:check
```

The release check runs type checks, tests, fixture smoke coverage, validation,
and a package smoke that asserts the CLI, docs, README, license, and security
policy are present in the npm tarball.

CI runs the same `npm run release:check` gate for pull requests and pushes to `main`.

## Limitations

V1 validates fixture shape and review coverage. It does not replace production authorization, identity checks, or connector-specific enforcement.
