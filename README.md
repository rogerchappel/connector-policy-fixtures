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
- `validate <file>` checks the schema, case checksum, unique case IDs, decision coverage, rollback requirements, broad targets, and secret-looking payloads.
- `matrix <file> --format markdown` renders a policy decision matrix.
- `render <file>` is an alias for `matrix`.

See [docs/CLI.md](docs/CLI.md) for fixture-backed smoke commands and exit behavior.

Each `init` input must be a JSON object with string `id`, `connector`, `action`,
and `target` fields and a boolean `writes` field. An optional `payload` must be a
JSON object. `init` validates every manifest before creating its output; an
invalid manifest exits with status 1 and identifies its source file and field.

Fixtures include a checksum of their `cases` array. If cases are edited, regenerate
the fixture with `init`; `validate` rejects stale or malformed checksums rather than
silently accepting hand-edited integrity metadata.

The validation input must be a JSON object with string `schema`, `generatedFrom`,
and `checksum` fields plus a `cases` array. Each case requires string `id`, `connector`, `action`, `target`,
and `rollback` fields; a `risk` of `low`, `medium`, or `high`; a `decision` of
`allow`, `block`, or `escalate`; a boolean `approvalRequired`; and an object
`payload`. Malformed shapes produce stable validation issues and exit status 1,
rather than JavaScript type or iteration errors.

## Safety Notes

The CLI never executes connector actions and never contacts live services. Keep examples synthetic and avoid credentials, private account IDs, or production payloads.

## Release Verification

```bash
npm run release:check
npm pack --dry-run
```

The release check runs type checks, tests, fixture smoke coverage, validation,
and a package smoke that asserts the CLI, docs, README, license, and security
policy are present in the npm tarball.

CI runs the same `npm run release:check` gate for pull requests and pushes to `main`.

## Limitations

V1 validates fixture integrity and review coverage. It does not replace production authorization, identity checks, or connector-specific enforcement.

## Verification

Run the local gates before opening a pull request:

```sh
npm test
npm run check
npm run smoke
npm run package:smoke
npm run release:check
```
